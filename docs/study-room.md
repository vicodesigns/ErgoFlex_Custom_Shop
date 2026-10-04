# Study and library rooms

Open `index.html?room=study&view=room` or choose **Study** in the scene bar.
Study has independent room/mode preferences and saved edits.

| Room | Interior floor | Ceiling |
| --- | --- | --- |
| Apartment writing nook | 2.8 × 3.2 m | 2.6 m |
| Home study & reading room | 3.6 × 4.2 m | 2.7 m |
| Writer’s study & library | 4.2 × 4.8 m | 2.8 m |
| Private library & lounge | 5.2 × 5.8 m | 3.0 m |
| Library & conversation suite | 6.5 × 7.0 m | 3.2 m |

Both nominal desktop widths use the same architectural millimetre scale.
First entry chooses the apartment for a 48″ desktop or home study for a 60″
desktop. Once selected, room dimensions remain fixed when switching desktops.
Glide spans the whole physical floor, constrained by the desk footprint.

## Design

Sage walls, oak wainscoting and floors, patterned woven rugs, an original
contour landscape, a window with curtains and warm brass reading lamps.
Original oak library bays have six shelves of differently sized books with
gold spine details. Book bodies and spine bands use instanced geometry, and
owned instance buffers are disposed when replacing a scene. Library bays,
reading lamp, landscape and chess table retain editable group identities.

The writing desk uses the library laptop, journal, pen, glasses and lamp;
books and a small ornament sit on its shelf. The supplied Steelcase Leap V2
and a leather reading chair appear in every room, with a side table and tea.
The other four rooms add a globe console. Larger libraries add a leather and
wood lounge sofa, coffee table, gramophone and plants. The largest includes
a bookwheel and original chess table with stools. The chess set is decorative;
no gameplay, audio or gramophone playback is included.

## Modes

| Mode | Height | Tilt | Desk LEDs |
| --- | --- | --- | --- |
| Morning | 43.5″ | −5° | Off |
| Afternoon | 28″ | 0° | Off |
| Evening | 28″ | 12° | Warm white |
| Night | 28″ | 0° | Warm white |
| Conversation | 43.5″ | 0° | Amber |

Each mode changes sky, daylight, four practical lights, shelf accents and
posture. Conversation turns the desk toward the room; its internal ID is
`party`. Manual lighting and motion controls remain available.

Projects preserve Study mode/layout and edits under `study:<layout-id>`,
independently of Home Office, Gaming, Music and Artist. All imported furniture
keeps its physical size and origin. Framed artwork stays attached to its
cutaway wall. Room furniture does not affect the price or desk AR export;
this room visualization does not implement furniture collision detection.

Run `npm run test:study` for physical bounds (including instanced books), both
desktops, all lighting/posture modes, nested artwork and desk edits, separate
scene preferences and project restore. Refresh the site bundle to publish;
include study-room.mjs along with the shared Studio files.
