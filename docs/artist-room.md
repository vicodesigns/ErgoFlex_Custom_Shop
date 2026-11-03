# Artist Studio

Open `index.html?room=creative&view=room` or choose **Artist studio**.
The existing Creative scene ID is retained for saved projects.

| Room | Interior floor | Ceiling |
| --- | --- | --- |
| Apartment art nook | 2.8 × 3.2 m | 2.6 m |
| Home artist studio | 3.6 × 4.2 m | 2.7 m |
| Drawing & painting studio | 4.2 × 4.8 m | 2.8 m |
| Artist atelier & lounge | 5.2 × 5.8 m | 3.0 m |
| Fine art & making suite | 6.5 × 7.0 m | 3.2 m |

The 48″ and 60″ buttons change only the desktop. The first visit chooses the
art nook for 48″ or home studio for 60″; subsequent room choices stay fixed.
Architectural scale comes from the nominal desktop width, independently of AR
calibration. Full-room Glide uses the physical floor and desk footprint.

Pale oak floors, plaster walls, terracotta drawers, a daylight window, pinned
color studies, original canvas artwork and task lighting form the scene.
Every room has the supplied Steelcase chair and drawing tools on the moving
desk. Larger rooms add a painting easel and a cabinet-mounted 3D printer;
the spacious room has a reading chair. The two largest have a paper/materials
worktable and visitor lounge; the largest also has a sculpture study.
Original geometry and canvas textures are in `artist-room.mjs`; imported
props come from the existing library and keep their native dimensions.

| Mode | Height | Tilt | Desk LEDs |
| --- | --- | --- | --- |
| Morning | 43.5″ | 12° | Off |
| Afternoon | 28″ | 18° | Off |
| Evening | 43.5″ | 30° | Warm white |
| Night | 28″ | 12° | Warm white |
| Open studio | 43.5″ | 0° | Amber |

Modes update sky, daylight, four practical lights, accents and posture.
Open studio turns the desk toward visitors (internal mode ID `party`). Manual
controls remain available. Night task lights keep artwork readable; these
materials are visualizations rather than calibrated color proofing.

Imported assets and original framed studies, easel, materials worktable and
sculpture group are editable in Studio. Framed studies are attached to the
cutaway wall and keep their individual editor identities. Project files and
preferences remember Artist's room/mode and per-room edits separately from
Home Office, Gaming and Music. The procedural group moves with its own
support geometry; imported tabletop props remain individually editable.
Furniture collision detection is not implemented. Room decor does not change
the desk price or AR export. No painting or 3D printing simulation is included.

Run `npm run test:artist` for physical bounds, both desk sizes, all five
posture/light modes, nested artwork edits, scene separation and project restore.
Website publication requires a refreshed site bundle including artist-room.mjs.

## Studio refinement — 25 October 2026

All five layouts share a connected daily still-life study: charcoal drawing in
Morning, partial colour in Afternoon, refinement in Evening, a nearly finished
work during Night clean-up, and the completed piece for Open studio. In the
small nook this appears in the central framed study; larger studios use the
floor easel. The editable reference pinboard carries matching session notes.

The painting now rests on its easel bar behind a retaining lip. Its rear brace
stays behind the canvas, the upper clamp meets the frame, and a supported side
shelf keeps brushes out of the picture. The taboret has a glass palette,
charcoal sheets, hand-painted swatches, and a fitted metal cover for clean-up
and viewing. Drawer cards and pigment bands make the materials chest legible.
The palette contents follow their editable parent and remain deleted/hidden
when switching activities. Existing scene asset keys are retained.

Neutral task light supports colour work; warmer picture lights and lanterns
carry evening and open-studio atmosphere. Night festoons are subdued. Foliage
stays inside the room, with a smaller fig in the nook to clear the 60″ desk.

Verification:

- `node tests/artist-studio-sessions-test.cjs`: all five layouts and activities,
  canvas/rest/lip/brace geometry, palette bounds and support, edit visibility,
  distinct artwork and lighting, and room bounds.
- `node tests/artist-studio-groove-test.cjs`: 50 clear routes across all layouts,
  five activities, and both 48″/60″ widths, using isolated browser storage.
- Visual review: overview and easel/storage views for every layout/activity.
