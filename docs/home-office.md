# Home Office in Studio

Open `index.html?room=home&view=room&layout=house&tour=1&v=home-sessions-20261022` or choose **Home office** in the scene bar.

| Room | Interior floor | Ceiling |
| --- | --- | --- |
| Apartment office | 2.8 × 3.2 m | 2.6 m |
| Dedicated home office | 3.6 × 4.2 m | 2.7 m |
| Spacious home office | 4.2 × 4.8 m | 2.8 m |
| Premium home office | 5.2 × 5.8 m | 3.0 m |
| Executive office suite | 6.5 × 7.0 m | 3.2 m |

Room choice and **48″ / 60″ desk** are independent. Furniture retains its physical dimensions. The room uses a consistent layout calibration across size changes and saved-project imports, independent of phone AR preferences. Each layout and desk width retains its existing separate setup.

The open front and exterior-facing wall cutaways make the rooms easy to inspect. The ceiling fixture hides from above so it does not obscure the floor plan.

## Daily activities — October 2026

| Activity | Lighting and small details | Groove desk posture |
| --- | --- | --- |
| Morning | Fresh daylight, coffee and spoon, a fresh-start pinboard note | 43.5″ / −5° |
| Afternoon | Balanced daylight, water carafe and cup, a focus note | 28″ / 0° |
| Evening | Warm reading lamp, tea caddy and cup, reading-hour note | 28″ / 12° |
| Night | Quieter shelf lighting, restrained fairy lights, charging case and cable | 28″ / 0° |
| At home with friends | Warm shared light, two cups and spare coasters, a welcoming note | 43.5″ / 0° |

An activity selection updates the room and prepares its routine. **Start Groove** moves the desk and changes its posture. Saved Groove destinations keep priority. Light & quality allows manual adjustments after selecting an activity.

The existing clock, window view, roman shade, practical lamps and screen themes follow the day mode. The pinboard keeps its photos and calendar while one note changes. Its canvas is reused rather than allocating new textures at each change. Four practical point lights remain the lighting budget.

## Furnishings and materials

- Oak joinery, sage cabinets, linen curtains, woven rugs, glazed stoneware, brass and satin metal.
- A new editable coffee/reset tray rests on the cabinet and changes with the activity. It follows the cabinet when moved and stays hidden if the user hides it.
- The apartment has a narrow cabinet and repositioned lamp and shelf accessories, leaving clearance for the 60-inch desk and its routines.
- Larger offices have an entry beside the work area, clear of the reading chair and lamp. The wall guitar and hanger move together away from that doorway.
- Desk, reading and lounge rugs follow their furniture zones with visible gaps between them.
- The supplied Steelcase desk chair remains, with the Poppi reading chair, plants, books and floor lamps. Larger layouts add a coffee maker; the two largest include a lounge sofa.
- Night lighting maintains readable materials while reducing cabinet glow. Hosting uses warm light and neutral fabrics.

Procedural surfaces and daypart graphics are original deterministic canvas artwork. No extra texture downloads are needed.

## Editing and saved projects

Existing editor controls remain available. Layouts retain separate edits under `home:<layout-id>`, and project files preserve all edited layouts, selected activity and desk placement.

Migration moves only exact untouched legacy positions for the compact chairs, cabinet accessories, rugs and wall guitar. Deliberate translations, rotations and scales remain intact. New activity details are children of their supporting furniture; activity changes do not undo a user's hidden objects. Product recipes and graphics are unchanged.

## Verification

- `node tests/home-office-test.cjs`: five room layouts, both desktop widths, physical scale and bounds, five postures, independent edits, saved-project round trip and return to Product.
- `node tests/home-groove-test.cjs`: 50 room/width/activity combinations with route segment clearance.
- `node tests/home-sessions-test.cjs`: entrance and seating clearance, rug separation, five distinct lighting and pinboard states, attached decor, hidden objects and legacy migrations.
- `LIGHTING_SCENES=home node tests/room-lighting-test.cjs`: physical UVs, lights/shadows, grounding and resource disposal.
- `REALISM_SCENES=home node tests/environment-realism-test.cjs`: materials, activity supports and edit stability.
- Visual review: `scene-shots/home-sessions-20261022/`, all five layouts and five activities, overview and cabinet detail.

The local development server serves this update; it has not been published.

## Reading and lounge refinements — 23 October 2026

All five layouts now have a bronze reading lamp with a woven linen shade,
rounded diffuser and pull chain. It keeps the old lamp's edit key and stays
within its original footprint. The shade and diffuser follow each activity's
practical lighting, with no additional real-time lights. Reading tables have
honed, lightly pitted warm stone tops; armchairs gain woven linen cushions.

Premium and Executive sofas use a softer sage fabric, retaining their original
normal maps and decorative pillows. Their coffee tables now have five separate
settings: morning notes and coffee, afternoon fruit, an open magazine and tea
at dusk, stacked coasters at night, and a carafe with two cups for company.
Ceramics have hollow profiles and magazines have page edges and original cover
art. These details sit on the actual tabletop and travel with its editable root.
The setting can be moved or hidden separately. Built-in books are grouped with
some horizontal stacks and gaps instead of uniform rows.

The existing Home session test additionally checks lamp dimensions, tabletop
bounds, one active lounge setting per activity, support following and hidden
state. Product recipes, per-width setups and saved furniture identities remain
intact. Open `?room=home&view=room&layout=premium&tour=1&v=home-comfort-20261023`.

Verified 24 October: all 50 layout/width/activity routes and all five layout
contact/edit checks passed. Review images and results are in
`scene-shots/home-comfort-20261024/`, including final lounge details.
