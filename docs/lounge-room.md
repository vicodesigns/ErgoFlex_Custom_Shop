# Lounge

Preview: `index.html?room=lounge&view=room&layout=spacious`.

| Room | Floor size | Ceiling |
| --- | --- | --- |
| Apartment living lounge | 3.6 × 4.2 m | 2.6 m |
| Home lounge & listening room | 4.6 × 5.4 m | 2.8 m |
| Media lounge & arcade corner | 5.8 × 6.4 m | 3.0 m |
| Social lounge & games room | 7.2 × 8.0 m | 3.2 m |
| Private entertainment suite | 9.0 × 9.5 m | 3.4 m |

Walnut floors, sage walls, linen curtains, warm lamps and original sunset art
frame a sofa and cinema display. Every tier includes a retro arcade cabinet.
Larger rooms add a jukebox, a second cabinet and reading chair, then a
refreshments bar and foosball. The largest includes three cabinets and an
original billiard table. Furniture, consoles, artwork and games are editable
Studio assets. Native library models retain their physical dimensions.

Morning, Afternoon, Evening, Movie night and Game night change daylight,
four practical lights, screen and fireplace glow, desk posture, placement and
LEDs. Room choice, mode and edits save independently and round-trip through
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
