# Workspace accessories and scenes

The storefront and Studio now preview selected accessories on the reference
desk. `workspace-3d.mjs` owns original geometry and mounting;
`workspace-icons.mjs` supplies original SVG card illustrations.

**No third-party model files or product photographs are redistributed as
purchasable accessories.** That statement covers this document's subject: every
priced accessory is original geometry built from published dimensions. It does
**not** cover the room prop library in `assets/props/`, which is converted from
third-party Sketchfab and Rhino files under unconfirmed licences. Read
[scene-assets.md](scene-assets.md) before publishing any of it.

## Product references

Manufacturer references checked September 10, 2026:

| Product | Published dimensions used | Reference |
| --- | --- | --- |
| Dell UltraSharp U2724D | Panel 612.24 × 352.51 × 50.12 mm; stand depth 192.28 mm; preview height 450 mm within the published 385.58–535.58 mm range | [Dell specification sheet](https://www.delltechnologies.com/asset/en-us/products/electronics-and-accessories/technical-support/dell-ultrasharp-27-monitor-u2724d-datasheet.pdf) |
| Logitech Lift for Business | 70 mm wide × 108 mm deep × 71 mm high; right-handed visualization | [Logitech specification sheet](https://www.logitech.com/content/dam/logitech/en/business/pdf/ergo-lift-b2b-data-sheet.pdf) |
| Logitech ERGO K860 for Business | 456 mm wide × 233 mm deep × 48 mm high | [Logitech specification sheet](https://www.logitech.com/content/dam/logitech/en/business/pdf/ergo-k860-for-business-data-sheet-w11.pdf) |

Shapes are illustrative approximations with published overall dimensions, not
manufacturer CAD. Stand, key, button and surface details are simplified. All
accessory prices remain provisional planning estimates. These entries do not
establish inventory, reseller status or a brand partnership. Manufacturer
specifications are linked from the product cards.

Task light, mat, mounting arms, cable tray, CPU cradle and foot rest are generic
concept accessories. Arm travel, clamp clearance and load ratings need product
confirmation. The CPU cradle is empty; selecting one monitor always shows one
monitor, including with the dual arm. The remaining mounting head stays empty.

## Placement and movement

Models use millimetres with X across the desk and Z toward the user. Mounts map
these to the CAD model's width on Z and depth on X using the existing lift
calibration. They find the upward working faces of `Desktop_3` and `Top_Shelf_4`
from geometry, avoiding raised edges in their bounding boxes. Bind transforms
are captured at neutral lift, tilt and glide.

Keyboard, mouse, mat, lamp, tray and cradle follow the desktop. Monitor and arms
follow the upper shelf. The separate foot rest stays on the floor during
lift/tilt and moves with glide. The mat raises the keyboard and mouse by 3 mm.
Selecting a mount removes the display's stand; removing it restores the stand.
Single and dual arms replace each other on selection, shared links and imports.

Generated objects live outside the part registry, preserving CAD part IDs, rig
membership and clone graphs. Visibility follows the mounting surface. Selected
accessories are included in image captures and AR exports; room scenery is
excluded from AR. Removed geometry and replaced rooms are disposed.

Saved configurations, share links, project files, cart previews and estimates
use the existing accessory IDs. Startup applies accessories after the CAD model
loads. Project presentation includes `roomScene`; the last scene is also a
browser preference. Older projects default to Product.

## Scenes

Product, Office, Home office, Music studio, Gaming, Creative studio, Lounge,
Kitchen, Home gym, Sci-fi bay, Bedroom, Workshop, Study and Gallery are actual
3D environments. Rooms include
floors, rugs, walls, scene-specific procedural furnishings, and props from the
converted library placed on the floor, on the walls, on the ceiling, on the
desktop and on the upper shelf. Walls hide when the camera orbits behind them.
Desk dressing follows the desktop and shelf through lift, tilt and glide, using
the same mounting surfaces as purchased accessories but its own groups.

Room furnishings and desk dressing are for inspiration, do not affect the
estimate, never add hidden products to a build, and are excluded from the AR
export. Scene asset edits made in the studio are stored per room, separately
from the build.

The [sizing limitation](sizing-gate.md) still applies: reference CAD does not
change width when the priced size changes. This implementation does not certify
manufacturing fit, ergonomic suitability or mount load capacity.

## Verification

`npm test` includes `tests/workspace-checks.cjs`: physical envelopes, keyboard
contact, lift/tilt/glide attachment, floor contact, mount replacement, size
fallback, room replacement, price independence, project scene serialization,
cart preview, saved-build restoration and mobile controls.
