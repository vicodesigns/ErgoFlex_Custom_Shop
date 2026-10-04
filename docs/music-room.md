# Music Studio in Studio

Open `index.html?room=music&view=room` or choose **Music studio** in the scene bar.
The measured room framework is shared with Home Office and Gaming; Music has
its own layout, lighting, remembered preferences, and edits. Afternoon is the
initial mode.

| Room | Interior floor | Ceiling |
| --- | --- | --- |
| Apartment recording nook | 2.8 × 3.2 m | 2.6 m |
| Home production studio | 3.6 × 4.2 m | 2.7 m |
| Writing & recording room | 4.2 × 4.8 m | 2.8 m |
| Producer studio & lounge | 5.2 × 5.8 m | 3.0 m |
| Production & performance suite | 6.5 × 7.0 m | 3.2 m |

The 48″ and 60″ desktop buttons do not change room or furniture size. On a
first visit, a 48″ desktop starts in the apartment and a 60″ desktop in the
home production studio. Once selected, the room remains independent of the
desk. The nominal desktop width establishes the architectural millimetre
scale; phone AR calibration does not alter it.

## Design

Music uses walnut floors and joinery, woven rugs, moss and clay acoustic
panels, diffuser blocks, a ceiling cloud, a real window opening with curtains,
original waveform artwork, and amber/lavender session lighting.

Each room has the supplied Steelcase Leap V2, monitor speakers on floor
stands, an equipment cabinet with the library recorder, a wall guitar,
books, plants, a vocal microphone, and a floor lamp. The composing desk has
a 49-key MIDI controller, curved display, Mac Studio, mouse, and headphones.
The smallest room uses the desk controller to save space. The other four add
an 88-key stage piano, bench, and score tray. The spacious room has a listening
chair; the two largest have a listening lounge, coffee table, refreshment
corner, award display, and a second guitar. The largest also has a drum kit.

The keyboard, stage piano, microphone/pop filter, and drums are original
procedural geometry in `music-room.mjs`. Imported equipment comes from the
existing prop library. No audio engine or instrument playback is included.

## Session modes

| Mode | Height | Tilt | Desk LEDs |
| --- | --- | --- | --- |
| Morning | 43.5″ | −5° | Off |
| Afternoon | 28″ | 0° | Off |
| Evening | 28″ | 10° | Amber |
| Night | 28″ | 0° | Lavender |
| Performance | 43.5″ | −5° | Coral |

Modes change sky, daylight, room practicals, accents, LEDs, and posture
together. Performance also turns the desk toward the live area. It uses the
internal mode ID `party` to share the existing five-mode framework. Manual
desk and lighting controls remain available after a mode is selected.
Four point lights add no extra shadow maps. The ceiling cloud and individual
walls hide as appropriate for the cutaway camera.

## Editing and projects

Imported props and the original instrument groups are selectable and movable
in the existing Studio editor. The desk MIDI controller and display follow
lift, tilt, and Glide. Original piano/bench, microphone, and drum groups use
stable asset identities; moving a group also moves its support geometry.
Room edits are stored under `music:<layout-id>`. Projects preserve Music's
room/mode and edits alongside independent Home Office and Gaming settings.

Full-room Glide constrains the desk against the floor boundary using its
actual footprint. Furniture collision detection is not included. These rooms
are visual inspiration; acoustic treatment performance is not simulated.
Room furnishings and desk dressing do not enter the price or AR exports.

The website upload builder includes `music-room.mjs`. Publishing requires
rebuilding/uploading the bundle; editing the local preview does not publish it.

## Verification

`npm run test:music` checks five layouts and both desktops, physical scale,
prop/instrument floor and wall bounds, all lighting/posture modes, independent
edits and scenes, and project restore. Screenshots go to `/tmp/ef-music-review`.
For a larger-room visual review:

```
node tools/props/scene-shots.mjs --only music --music-layout executive --music-mode party --views room --out /tmp/ef-music-final
```
