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

Product, Office, Home office, Music studio, Gaming, Artist studio, Lounge,
Kitchen, Home gym, Sci-fi bay, Bedroom, Workshop, Study and Gallery are actual
3D environments. Rooms include
floors, rugs, walls, scene-specific procedural furnishings, and props from the
converted library placed on the floor, on the walls, on the ceiling, on the
desktop and on the upper shelf. Walls hide when the camera orbits behind them.
Desk dressing follows the desktop and shelf through lift, tilt and glide, using
the same mounting surfaces as purchased accessories but its own groups.

[Home Office](home-office.md) and [Gaming](gaming-room.md) have five measured
room tiers, independent desktop/room selection, and Morning through Party
lighting/posture modes. Gaming adds slatted acoustic walls, RGB lighting, a PC
display cabinet, and console lounges in the larger rooms. Both use physical
floor bounds for Glide and preserve edits separately for each layout.

[Music Studio](music-room.md) uses the same five measured room tiers with its
own warm acoustic treatment, composing/recording desk, and Morning through
Performance session modes. Larger studios add a stage piano and listening
lounge; the largest includes a drum kit. Instrument groups are editable.

Room furnishings and desk dressing are for inspiration, do not affect the
estimate, never add hidden products to a build, and are excluded from the AR
export. Scene asset edits made in the studio are stored per room, separately
from the build.

The [sizing limitation](sizing-gate.md) still applies: reference CAD does not
change width when the priced size changes. This implementation does not certify
manufacturing fit, ergonomic suitability or mount load capacity.

## Artist Studio

[Artist Studio](artist-room.md) adds five measured drawing and painting spaces,
original art, easels, materials storage, visitor lounges and a sculpture area.
Morning through Night and Open studio modes adjust posture and lighting.
Preview: `index.html?room=creative&view=room`.

## Study

[Study](study-room.md) adds five measured writing and library rooms, from an
apartment nook to a private library and conversation suite. Reading lamps,
oak bookshelves, warm modes, a globe, bookwheel and chess area complement the
moving desk. Preview: `index.html?room=study&view=room`.

## Verification

`npm test` includes `tests/workspace-checks.cjs`: physical envelopes, keyboard
contact, lift/tilt/glide attachment, floor contact, mount replacement, size
fallback, room replacement, price independence, project scene serialization,
cart preview, saved-build restoration and mobile controls.

## Shared Office

[Office](office-room.md) adds five measured shared spaces with two to six ErgoFlex
desks. The main desk uses the existing app controls; the others are dressed for
drafting, digital design, prototyping, architecture and research. Morning through
Night and Team social modes change the main desk and lighting.
Preview: `index.html?room=office&view=room`.

## Home Gym

[Home Gym](gym-room.md) adds five measured training spaces with rubber floors,
free weights, recovery furnishings and lime/cyan lighting. Larger rooms add
cardio and strength stations. Morning through Power session modes change the
main desk and lighting. Preview: `index.html?room=gym&view=room`.

## Kitchen

[Kitchen](kitchen-room.md) adds five measured spaces with oak and jade cabinets,
brass fittings, breakfast seating and coffee corners. Larger tiers add dining,
waterfall islands and a display pantry. Morning through Dinner party modes
change the main desk and lighting. Preview: `index.html?room=kitchen&view=room`.

## Lounge and arcades

[Lounge](lounge-room.md) adds five measured cinema and games spaces, from an
apartment play nook to a private games suite. Larger rooms add a jukebox,
refreshments bar, foosball and billiards. Movie night and Game night complement
the daylight modes. Three original arcade cabinets also appear in the Studio
picker and larger Gaming rooms. Preview: `index.html?room=lounge&view=room`.

## Workshop

[Workshop](workshop-room.md) adds five measured maker spaces with plywood
benches, pegboard tools, drawer storage, materials racks and focused task
lighting. Larger tiers add assembly and fabrication bays. Morning through Open
workshop modes change the main desk and lighting.
Preview: `index.html?room=workshop&view=room`.

## Bedroom

[Bedroom](bedroom-room.md) adds five measured spaces with linen and sage walls,
oak wardrobes, bedside lamps and a daylight desk nook. Larger tiers add a
reading corner, dressing island and private lounge. Morning through Weekend
modes change the main desk and room lighting; Night turns desk LEDs off.
Preview: `index.html?room=bedroom&view=room`.

## Gallery

[Gallery](gallery-room.md) adds five measured art spaces with original framed
art, stone sculpture plinths, oak exhibition benches and brass picture lights.
Larger tiers add a glass display case, collector salon and sculpture hall.
Morning through Opening night modes change the main desk and room lighting.
Preview: `index.html?room=gallery&view=room`.

## Sci-fi bay

[Sci-fi bay](scifi-room.md) adds five measured orbital spaces with deck plates,
mission graphics, crew storage, a robot dog and an original planet window.
Larger tiers add research, tactical and robotics areas using existing space
and factory assets. Morning through Hyperdrive modes change the desk and
cyan/violet lighting. Preview: `index.html?room=scifi&view=room`.

## Co-working

`index.html?room=coworking&view=room&layout=spacious&v=coworking-rooms-20261002`

Five measured shared spaces, from a 5.4 × 6.8 m neighbourhood work lounge to
a 14 × 15 m flagship floor. Each includes 2–6 actual ErgoFlex stations, native
Steelcase chairs, a café, community board and social seating. Larger layouts
add meeting areas, acoustic focus seating and call booths. Morning through
Community social adjust physical lighting and the active desk posture.

`npm run test:coworking` checks dimensions, both desktop widths, secondary
station independence, material batching, physical bounds, mode lighting,
editing and project restore. Room size and time of day remain independent.

## Library

`index.html?room=library&view=room&layout=house&v=library-rooms-20261002`

A campus-library concept for the student pilot, from a 5.4 × 6.6 m study nook
to an 18 × 20 m commons. The active ErgoFlex has a Steelcase chair, student
pilot signage and study accessories. Native reading furniture, original oak
stacks with instanced books, study tables, quiet carrels and a redwood window
view fill the larger rooms. It can be adapted to Cal Poly Humboldt pilot-area
photos or dimensions; it is not a measured reconstruction of the campus.

`npm run test:library` checks five layouts, both desktop widths, book batching,
furniture bounds and tabletop contact, five modes, editing and project restore.
