# Keyboard tray: the three edits from the supplied model (v1) to the film's model (v2, "B+")

Vico chose this option after his photos of 25 Nov 2026. Each edit is listed so it can be redone in your own CAD. The exact build is `tools/props/tray-rig-v2.mjs`, and the files in this folder are its output.

## Coordinate systems

* **Track frame** (used in the numbers below; millimetres):
  * **u** runs across the tray, left to right as you sit at it.
  * **y** is up; y = 0 is the top of the track plate, which is the desktop underside.
  * **w** runs along the slide toward you.
  * The supplied model is turned 7.43 deg about the vertical, so the track frame is the model's x/z turned by that angle.
  * In the side photos (profile-02, -04, -05), w runs left to right (the rear bracket is on the left, the platform on the right) and y runs up the picture.
* **Rhino files** (`*.obj`, `*-stl/*.stl`), Z up, mm:
  * Rhino x = model x.
  * Rhino y = -(model z), so +y points AWAY from you, toward the back of the desk.
  * Rhino z = model y (up).
  * The origin is the tray's origin on the desktop underside.
* **Original units:** the supplied KeyboardTray.glb is a triangle mesh whose CAD numbers were read as inches. The "in" values below are the mm divided by 25.4, as an approximate guide only; the import scale was never verified.

## The pivots

| Bolt | Track frame u, y, w (mm) | Rhino x, y, z (mm) | Joint |
|---|---|---|---|
| Rear upper bolt, v1 (supplied) | -10, -23.85, 8.75 | -11.05, -7.38, -23.85 | |
| Rear upper bolt, **v2** | -10, -23.85, **46.86** | -15.98, -45.17, -23.85 | Base tilt |
| Front bolt (forks pin), v1 | -10, -69.7, 119.45 | -25.36, -117.15, -69.70 | |
| Front bolt, **v2** | -10, **-42.7**, 119.45 | -25.36, -117.15, -42.70 | Surface tilt |

The lock knob on its rod in the arc slot stays where it was (track frame y -80.7, w 98.6).

## Edit (a): the arm (Tray_Links), 120 -> 75 mm bolt to bolt (-45 mm, about -1.77 in)

* Cut the arm across its straight middle: halfway along the line from the rear bolt to the front bolt (119.82 mm long in v1).
* Move the front half back along that line by 44.82 mm (about 1.76 in).
* Both end eyes are kept as they are.
* Place the arm with its rear eye on the v2 rear bolt and its front eye on the v2 front bolt. At rest it slopes 14.56 deg down to the front; v1 sloped 22.5 deg.

## Edit (b): the forks' pin (Tray_Forks), 27 mm higher on the forks plate (+27 mm, about +1.06 in, along y)

* Move the pin piece and the rod across it (the arm's front bolt) up 27 mm on the forks plate. The plate outline stays.
* The platform then sits 23 mm above its bolt (it was 50 mm), as on the real front plate.
* The forks plate, the platform, the rod and the lock knob do NOT move.

## Edit (c): the rear bracket (Tray_Carriage), its two bolts 38.11 mm forward (along w, about +1.50 in)

* Move both bolts and their rods (upper at y -23.85, lower at y -44.6) 38.11 mm toward you.
* Stretch the front of the bracket's hanging side plates (below y -12) with them:
  * full stretch from w -12 forward;
  * fading out smoothly to none at w -45;
  * nothing moves across (u) or up/down (y).
* The slide block, guide rails and track are unchanged.
* This keeps the platform exactly where the supplied model has it at rest. The photos cannot show where the bracket sits along the slide, so today's platform position was kept.

## Result

| | v1 (supplied) | v2 |
|---|---|---|
| Arm, bolt to bolt | 119.8 mm | 75.0 mm (photo: about 78.5) |
| Platform top above the front bolt | 50 mm | 23 mm (photo: about 23) |
| Rest: platform top under the desktop | 19.7 mm | 19.7 mm (identical, 0 mm move) |
| Arm at rest | 22.5 deg down | 14.6 deg down |
| Arm flat (tucked, your everyday pose) | platform 26.2 mm INTO the desktop | platform 0.8 mm under the desktop |
| Base tilt range in the film | (none) | -30 .. +12.9 deg (+12.9 = platform levelled 3 mm under the desktop) |
| Surface tilt range | +-15 | -30 .. +30 (the arc slot) |

Files: `ErgoFlex-keyboard-tray-<v1-original|v2-committed>-<rest|tucked>.obj/.mtl`, one named object per part; and the same as one binary STL per part in `...-stl/`. "Tucked" = the arm flat with the platform levelled (v1: +22.5 / -22.5; v2: +14.56 / -14.56). Parts: Tray_Track (mount plate), Tray_Carriage (rear L-bracket with its bolts), Tray_Links (arm), Tray_Forks (front plate with its pin), Tray_Crossbar (rod and lock knob), Tray_Screw, Tray_Plate (platform). The bolts are part of Tray_Carriage and Tray_Forks in the source mesh and are not separate objects.

STEP: none. There is no STEP exporter here other than Rhino itself, and a STEP made from this mesh would only be a FACETED shell (triangles), not editable CAD. In Rhino you can do it yourself: Import the OBJ, run MeshToNURB, Export as STEP. Label the result FACETED-from-mesh.
