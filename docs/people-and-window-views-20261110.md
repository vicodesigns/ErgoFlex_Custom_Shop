# People in the rooms and photographed window views (November 10, 2026)

## Customer controls

- **Studio → People** (toolbar checkbox, shown in rooms that have a cast): puts people in the room. Off by default; the
  models load the first time it is switched on, and the choice is remembered in this browser (`?people=on` forces it).
- The person at the featured desk follows the desk: seated while it is at sitting height (28 in or 30 in), standing at
  43.5 in, and fading out in between. They move with the desk when it glides or turns. A seated desk user brings the
  task chair their pose was built on; the room's own chair at that spot steps aside and comes back afterwards.
- **Object library → People**: every posed person is also an ordinary library item (category `people`), so they can be
  placed by hand in Studio and added, moved or removed per chapter in Director Mode like any other prop.

## Who is where

`room-people.mjs` → `ROOM_PEOPLE`. Home, gaming, music studio, artist studio, gym, workshop, high school, OCC media lab
and the Humboldt commons have casts. The high school and the media lab seat a wheelchair user at their accessible desk;
the commons has a short-statured user standing at the desk's lowest setting, a white-cane user and a walking-stick user;
one gamer has a below-knee prosthesis. Every other adult room (office, co-working, bedroom, lounge, kitchen, study,
gallery, classic library, sci-fi and the remaining institutional rooms) gets one desk user who sits or stands with the
desk (`DEFAULT_CREW`). The children's rooms (child room, kindergarten, elementary) have no cast yet: the models are
adults and teenagers.

## The film

A shot takes `people: true`, or a cast for that chapter (`experience/stage.mjs`, `room-people.mjs` `setFilter`):

    people: {
      only: [keys], except: [keys],                  who of the room's own cast is in
      place: { '<key>': { at: [x, z], turn, y } },   moves someone (room millimetres)
      cast: [ { key, id, at | desk | station | on | by, ... } ],   extra people, placed like the room's own
      when: { '<key>': [[t0, t1, fadeIn, fadeOut], ...] },         the seconds of the chapter each is there (fade .5 s; 0 cuts)
      chair: { back, side, turn }                    the desk user's chair stays in the room, pushed back while they stand
    }

A key is a placement's `key` (one model can be cast twice) or its id. The stage passes the chapter's time to the
people each frame, so `when` holds in the film and in Director; in the Studio there is no time and everyone is there.
Shots without `people` have nobody, as before.

`tools/experience/build-alt-cut.py` writes the alternate cut from Vico's review cut: the same lengths and desk moves,
with a cast and, where the people change the story, a reworked camera per chapter (see
`exports/cinematic-intro-20261110-alt/README.md`). `tools/experience/pick-chapters.py` lists the differences and mixes
the two cuts chapter by chapter. Camera positions in the builder are room millimetres; one stage unit is 662.84 mm
and the room root turns x into -z (`W()` in the builder).

## Building people

`python3 tools/people/build.py [id ...] [--preview dir]` (Blender 4.2 + the MPFB extension and MakeHuman CC0 asset packs
in `~/blender/mpfb-user`; see the file's header). `tools/people/cast.py` holds the characters, poses and the list of
models; `pose_lib.py` poses the rig (hands and feet go to targets, then the result is baked); `held.py` makes what people
hold or use (phone, book, pen, cane, white cane, wheelchair, prosthesis, headphones). Desk poses take the desk height:
the keyboard top is 678 mm at 28 in, 759 mm at 31 in and 1095 mm at 43.5 in, measured in the app. Each model is about
35–50 thousand triangles and 0.7–1.2 MB. `node tools/props/thumbnails.mjs --collection people` renders the library
thumbnails. Test: `npm run test:room-people`.

Heights: the `height` setting is about 1.29 m per unit (0.5 is 1.51 m for an adult woman, 1.80 m for a man). The adult
women are set to 1.52 to 1.64 m and Noah to 1.77 m, so a 43.5 in standing desk meets their elbows. A new pose is a
few lines in `cast.py` and builds in about six seconds; `--preview dir` renders two views to check it.

## Window views

`window-vista.mjs` replaces the painted window canvases with photographs (crops of CC0 Poly Haven panoramas,
`tools/rooms/build-window-vistas.py`, `assets/rooms/vistas/`). Each view ray through the pane is mapped to a pixel of
the photograph, so the outside sits at a distance and shifts as the camera moves. Dayparts are a grade; the city views
switch to a photograph taken after dark. The painted canvas stays as the fallback until the image has loaded.

| Room | View |
| --- | --- |
| Home | garden |
| Artist studio | walled studio garden |
| Gym, music studio | city (day), dusk skyline after dark |
| Gaming room | city (day), neon skyline across the water at night |
| Workshop | yard |
| High school, OCC media lab | coast |
| Kindergarten, elementary | garden |
| Office, co-working, lounge, gallery | city (dusk skyline after dark) |
| Bedroom, kitchen | garden |
| Study | campus |
| Other institutional rooms | campus or city |

In the film, a chapter's `@window` edit takes `vista: { brightness, soften, zoom, horizon }`. The older
`material.brightness` / `mapBlur` values on those edits were tuned for the painted canvas and are skipped for a vista.

## Not done yet

- The child rooms and the classic library still have painted window views; the children's rooms have no cast.
- The alternate cut leaves the opener and the finale as Vico has them (no people on the dark stage, and their framing
  is tied to the titles and the end card).
- The alternate cut is not in Director: it needs this branch merged, and the import watcher kept from writing an
  alternate chapter into his cut.
- Where a person changes pose inside one shot, the two poses dissolve into each other.
- The opening chapter cannot be rendered on the desk machine: its screen clip (`hq14/screens/01-main.mp4`) only exists
  on the render PC.
