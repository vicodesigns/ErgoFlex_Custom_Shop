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
- Both new cuts (`exports/cinematic-intro-20261110-people/`: his cut with people; `-alt/`: the alternate) leave the
  opener and the finale as Vico has them (no people on the dark stage, and their framing is tied to the titles and
  the end card).
- Neither is in Director: Director pages and the import watcher only know the hq14 folder, and an export of one of
  these chapters must not be written into his cut.
- Where a person changes pose inside one shot, the two poses dissolve into each other. While a desk is moving its
  user stands at it in the `stand-wait` pose (a film `cast` entry with `when`); in the Studio the desk user is
  simply hidden until the desk reaches a height a pose was built for.
- The opening chapter cannot be rendered on the desk machine: its screen clip (`hq14/screens/01-main.mp4`) only exists
  on the render PC.

## Director: the People tab (added November 10, 2026)

`experience/scene-people-editor.mjs` + `experience/people-edits.mjs`. On a film chapter the inspector has a People tab:

- the chapter's cast as a list (who, what they are doing, where, the seconds they are there); the eye takes a person out
  and keeps the entry; "Bring in the room's people" copies the room's standing cast into a chapter that has none;
- click a person in the view or in the list: move, turn and scale with the gizmo (W / E / T) or the fields, lift,
  "Face the desk", "Face the camera", duplicate, remove (Delete);
- Character (filters: sex, age, heritage) and Posture (standing, seated, wheelchair, walking; desk postures follow the
  film desk and show while it is at their height); a combination nobody has built is built on request;
- "In the room": the whole chapter, or In / Out seconds with fades;
- "+ Add person": the people library (search; filters for women / men, posture, wheelchair / walking stick / white cane /
  prosthesis).

The edits are `shot.peopleEdits = { cast: [{ key, id, hide?, desk | at + turn + y | beside, scale }], when, chair, fade }`
in the cut. They reach the live stage at once (`stage.peopleTrack`), travel in Export cut, and
`build-round8-director.py` writes them into the film chapter as `people: { only: [], cast, when }`. The first edit copies
the cast the film shows into the chapter, so every person is an entry of its own from then on.

`assets/props/people.json` (`tools/people/catalog.py`, rewritten by every build) lists the characters (name, sex, age,
heritage, height, outfit), the postures and the built models. `cast.output('people-<character>-<posture>')` makes any
combination buildable; the studio server builds one on `POST /__people/build?id=...` (from the desk machine only,
about eight seconds, thumbnail included). Models built this way are untracked files until committed;
`freeze-inputs.sh` puts them into a render freeze.

Clothes and hair: a colour each for top, bottom, shoes and hair (`colors` on the entry; room-people.mjs recolours
the model's own materials and keeps the brightness of the fabric's texture, so folds and weave stay).

Not there yet: other outfits per person, custom characters (sliders for build, age, height), a people lane in the
timeline, and a walk along a path. Test: `tests/director-people-e2e.mjs`.

## Director: pose mode (added November 10, 2026)

Double-click a person in the view, or press **Fine-tune pose…** in the People tab. The person's skeleton comes in (nothing moves) and dots appear on the joints.

- **Blue dots** turn a joint. Click one, then drag the rings, or type Bend / Twist / Side in the People tab.
- **Orange dots** are the hands and feet. Drag the arrows (W) and the whole arm or leg follows; the hand or foot keeps facing the way it did. E turns the wrist or ankle itself.
- **Fingers**: Open / Close per hand, a step at a time.
- **Copy to the other side** mirrors an arm's or a leg's adjustments. **Reset joint** (or Delete), **Reset arm / leg / torso**, **Reset the whole pose** go back to the posture as built.
- Every change is one Undo step. **Done**, Esc, or a double-click on empty space leaves pose mode; the pose stays.

How it works:

- Every people model now carries its skeleton (MPFB "game_engine" rig, 54 bones). The mesh is baked in its posture and that posture is the skeleton's rest pose, so an untouched skeleton changes nothing. The Studio and the film draw people as plain meshes; only a person with adjustments is drawn skinned (`room-people.mjs` `rig()` / `pose()`, `workspace-3d.mjs` `PROP_LIBRARY.rigInstance()`).
- Adjustments live in the chapter's cast: `cast[i].pose = { '<bone>': [x, y, z, w] }`, a turn of that bone from the built posture (`experience/people-edits.mjs` `cleanPose`). Export cut carries them into the film chapter's `people` (`build-round8-director.py` `clean_people`).
- Changing the character keeps the adjustments; changing the posture drops them.
- Things in the hands follow the hand; a wheelchair stays where it is.
- Code: `experience/scene-pose-editor.mjs`. Test: `tests/director-pose-e2e.mjs`.

## The whole library is built

Every character exists in every posture (desk postures at each desk height): 495 models, `python3 tools/people/build.py --all` (about ten minutes). The People tab's character grid and Posture list swap instantly; nothing is "built on request" any more. Only the 54 models the rooms use are in `tools/props/manifest.json`; all are in `assets/props/index.json` and `assets/props/people.json`.

## Director: the Cut menu (added November 10, 2026)

The timeline's chapter picker starts with **Cut**: the film's cuts (`exports/film-cuts.json`). Choosing one opens the same chapter of that cut. **＋ Duplicate this cut…** copies the cut you are in to a new one and opens it.

- A cut is a folder under `exports/` with a `review-cut.json`. Vico's cut (`exports/cinematic-intro-20261104-hq14`) is the master. Every other cut has a `cut.json` (`id`, `name`, `note`, `from`).
- Each cut's chapters are projects of their own in the browser (`film-<cut>-<chapter>`), so drafts and exports of one cut never land in another.
- Export cut and **Send to render PC** work in every cut: the request names the cut, the export is imported into that cut's folder, and the render job is the master's freeze with the cut's film data laid over it (`tools/experience/render-request.sh`).
- Tools: `python3 tools/experience/film-cuts.py list | adopt | duplicate | pages`. Duplicate from the Director needs the studio server's `/__film/duplicate` (a server started before November 10 must be restarted once).
- Not built: deleting or renaming a cut from the Director (remove the folder and run `film-cuts.py list`), and the builder chain for cuts other than the master (their chapters take Director edits; the opener's and the finale's special builders run for the master only).
- Tests: `tests/director-cuts-e2e.mjs`, `tests/render-request-cut-test.py`.
