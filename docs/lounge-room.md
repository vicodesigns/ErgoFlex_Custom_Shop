# Lounge

Preview: `/?room=lounge&view=room&layout=premium&style=contemporary`.

## Style selection

Use **Lounge style** in the room controls, or **Style** in the full-screen
room toolbar. Switching keeps the current room size and activity. Each style
has its own saved furniture and desk edits. New lounge visits default to
**Ultra-contemporary**; **Earthy & textured** retains the listening-room identity.

Contemporary rooms use walnut flooring, warm plaster, bronze and satin metal,
large abstract art, a centered illuminated desk feature, flush media storage
and sculpted stone coffee tables with cognac leather sofas. Premium and Executive add a refreshments
cabinet and an upholstered four-seat games setting. Earthy rooms use timber,
textiles, vinyl, a fireplace and arcade furniture. Both styles center the desk
on the rear wall; larger bars sit beyond the glazing and its 200 mm margin.

Bare layout IDs retain Earthy compatibility for existing cinematic chapters.
Contemporary IDs append `contemporary`, e.g. `premiumcontemporary`. The
`style` URL parameter can select the style with either base layout ID.


| Room | Floor size | Ceiling |
| --- | --- | --- |
| Apartment living lounge | 3.6 × 4.2 m | 2.6 m |
| Home lounge & listening room | 4.6 × 5.4 m | 2.8 m |
| Media lounge & arcade corner | 5.8 × 6.4 m | 3.0 m |
| Social lounge & games room | 7.2 × 8.0 m | 3.2 m |
| Private entertainment suite | 9.0 × 9.5 m | 3.4 m |

Each Earthy layout has its own coordinated palette, a modern desk finish, a
honed-stone coffee table, a quieter wool rug and a framed seating-area study.
Localized timber slats, matte plaster, felt media panels and restrained metal
details replace the former wall-to-wall walnut-and-gold treatment.

| Layout | Interior palette | Desk |
| --- | --- | --- |
| Apartment | Soft ivory and copper | Warm Ivory / Black / grey trim |
| House | Olive and nickel | Brushed Silver Wrap / Black / black trim |
| Spacious | Ink and walnut | Modern Grey / Black / grey trim |
| Premium | Clay and copper | Warm Ivory / Space Gray / copper-colored trim |
| Executive | Petrol and bronze | Brushed Silver Wrap / Black / black trim |

Every Earthy tier includes a retro arcade cabinet.
Larger rooms add a jukebox, a second cabinet and reading chair, then a
refreshments bar and foosball. The largest includes three cabinets and an
original billiard table. Furniture, consoles, artwork and games are editable
Studio assets. Native library models retain their physical dimensions.

Morning, Afternoon, Evening, Movie night and Game night change daylight,
four practical lights, screen and fireplace glow, desk posture, placement and
LEDs. Daytime neon is restrained, evening emphasizes warm practicals, and
movie night uses lower-glare screen bias with a small warm reading pool.
Candle flames are off in daylight. Sky/light-pool textures redraw only when
the activity changes. Room choice, mode and edits save independently and round-trip through
project files. The 48/60-inch selection changes the desk while room dimensions
stay fixed. Glide uses the full floor boundaries; furniture collision avoidance
is not simulated. Room scenery is excluded from cart pricing and AR export.

## Arcade library

The imported files and supplied ZIPs contained a jukebox and foosball table,
but no assets named arcade or pinball. Three original illustrative cabinets
were authored for this update, with original game art and marquees:

| Model | Envelope | Triangles |
| --- | --- | --- |
| Orbit Runner | 740 × 1885 × 873 mm | 880 |
| Pixel Garden | 740 × 1885 × 873 mm | 880 |
| Night Drive | 740 × 1885 × 923 mm | 408 |

Source files live in `models/arcade/`, public files in `assets/props/`, and
thumbnails in `assets/props/thumbs/`. They appear in the Studio model picker
under Original Arcade. `tools/props/build-arcades.mjs` regenerates the GLBs,
with embedded artwork, metre units and floor origins. These dimensions are
design approximations. Gaming adds one, two or three cabinets in its larger
room tiers; the apartment nook keeps its existing clear floor layout.

Verification: `npm run test:lounge` checks Lounge sizes, mode transitions,
asset bounds, project restore, mobile controls and the Gaming arcade lane.
The screenshot helper supports `--lounge-layout` and `--lounge-mode`.
The package file list includes the module; this does not publish local changes.

The November 5 design reset adds `npm run test:lounge-design` for measured
decoration, table support height, lamp/cabinet separation, palette migrations
and owner-edit preservation. The existing untouched Walnut/Sand/gold desk
recipe upgrades once; custom finishes remain editable. Untouched old furniture
anchors move to the new arrangement while moved, rotated or scaled owner
objects retain their transforms. The original coffee-table placement IDs and
391.2 mm top elevation stay available to the daily-life dressing system.


The second November 5 reset adds ten style/layout combinations, isolated
style persistence, softer contemporary shadows, a functional modern cinema
screen and measured window/bar separation. Main chairs and coffee tables
keep their measured anchors across dayparts to avoid the compact evening
collision. Imported controller bases now sit above the stone surface.
`tools/lounge-review.html` provides the 100-state visual/bounds matrix
(two styles × five sizes × two desk widths × five activities), plus a window
wall inspection view. Report evidence is in `docs/lounge-styles-20261105/`.


The November 6 warmth pass replaces the pale contemporary palette with
cognac leather (the existing generated leather family), walnut boards,
petrol/olive/ink/oxblood feature colors and bronze details. Games seating uses
coordinated colored upholstery. Evening mixes amber practicals with petrol
media light; Party lounge adds stronger amber, cyan and muted rose accents.
Both retain readable desk lighting. Large bars include a decanter and two
tumblers on a measured tray; the window margin and furniture anchors stay
unchanged. The ten-layout support/bounds checks pass after this change.
