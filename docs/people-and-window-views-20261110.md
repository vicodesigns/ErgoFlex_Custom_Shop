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

## Added November 10, 2026 (evening): saved poses, fingers, People lane, clothes, layout

- **Saved poses.** In pose mode, type a name and press **Save pose**. A saved pose is the posture plus the joints' turns from it; saving never replaces one (a taken name gets a number). Saved poses show under Posture in the People tab and in pose mode: click one to put it on the selected person (it changes their posture to the saved one if needed), × deletes it. They live in the browser under `ergoflex.peoplePoses.v1`, which the studio server shares and keeps in `studio-state.json` (`experience/saved-poses.mjs`).
- **Fingers.** One slider per hand: open, as built (0), fist (100). Every finger has one hinge axis taken from the finger as built; the thumb closes last onto the curled middle finger. (The earlier Open / Close steps turned joints backwards once a finger had curled past the palm.)
- **People lane.** Drag a bar's ends to set when the person comes in and goes out, its middle to slide the stay (tenths of a second). A bar pulled back to the whole chapter loses its span. People there at the same time get rows of their own.
- **Clothes.** The swatches show the colours the model really has (read from its textures on the stage, `RoomPeople.partColors`). Six characters (Mr Hale, Omar, Priya, Jo, Leo, Eli) wear a one-piece outfit: Top now colours it above the waist and Bottom below (`personLower` vertex attribute from the skin weights, `room-people.mjs` `recolor`).
- **Layout.** One film picker (the inspector's; the timeline shows its own only while the inspector is hidden). Above 2200 px wide the inspector, timeline and top bar are drawn a fifth larger (the 3D view is not zoomed). Lamps and Props show at most two rows of chips and scroll; the timeline's Fit takes 54 % of a window up to 1150 px tall; selecting a person scrolls the People lane into view. A new status light takes the free stretch at the playhead and never lengthens the chapter (refused when there is less than 0.3 s).
- `VIEW=2560x1440 node tests/director-…-e2e.mjs` runs any Director browser test at that window size.

## People at a desk follow it (late November 10)

Anyone at a desk sits or stands with that desk. Beside the model a placement names, `RoomPeople` loads the same
character's other desk postures under the same name (`deskFamily` in `room-people.mjs`: typing seated at 28 in and at
30 in, standing at 43.5 in; a wheelchair user's 28 in and 31 in poses) and shows whichever was built for the desk's
height now; between sitting and standing height nobody is at the desk. This applies to people a film or the Director
puts at a desk and to the people at a room's other desks (`station`), not to the rooms' own featured-desk crews, which
list their postures.

A person at one of the room's other desks reads that desk live (`peopleState().station(id)`, `studio.js`
`roomPeopleStation`): they stand where the desk stands now and take its height, so moving, turning or raising it in
the Director's Desks tab (or with a Lift on that desk's lane) takes them along. Before, their place and fit were
decided once from the layout, and choosing "standing" for someone whose desk was down made them vanish.

In the Director, the posture menu's seated and standing typing postures therefore behave alike at a desk. Pose mode
fine-tunes the posture that is showing: entering it while the desk has someone in another of their postures makes
that one the chosen posture first (fine tuning belongs to one posture). Tests: `tests/room-people-test.mjs`,
`tests/director-people-desk-follow-e2e.mjs`.

## Director Desks: gumball (late November 10)

A selected room desk has a gumball over it (arrows along the room's X and Z, a square for both), the round floor
handle as before, and a ring around its footprint whose knob turns it (Shift: 15° steps). A tooltip names what is
under the pointer and shows the numbers while dragging; each drag is one desk edit. The desk tools start with the
Desks tab. A click on a desk in the view used to leave the orbit controls without their pointerup (the desk tools kept
the event), so the camera turned with every mouse move until the next click; the tools now release the orbit controls.
Test: `tests/director-desk-gumball-e2e.mjs`.

## A cast for every hour (November 11)

The nine film rooms have a cast per daypart (`ROOM_PEOPLE` / `castEntries` in `room-people.mjs`; placements carry
`modes: [...]`, and `modes: []` keeps a placement only for film cuts that name it). Morning is an early start (standing,
a coffee), the afternoon seated work, the evening company or winding down, night one person or nobody (schools and the
gym are empty), the party a group with the desk left free. Clothes are recoloured per room (`LOOK`). New postures in
`tools/people/cast.py`: coffee at the desk seated and standing, standing with a mug or a drink, explaining, carrying a
box, kneeling at a shelf, sitting on the floor, a floor stretch, chatting seated, mixing with headphones, and
`stand-low`, a standing pose at a bench-height desk (35.5 in) that every character has and that is part of the desk
family. Rooms without a cast of their own keep one desk user, who is not there at night in offices, schools, galleries
and labs.

Rules the casts rely on: a person cast `on`, `near` or `by` furniture settles again when the daypart changes or that
furniture moves; a film chapter that names someone in `only` shows them whatever the daypart (`named`), and a model id
in such a list means the placement without a key of its own; a chapter that takes the room's people over
(`resolved()`) takes the current hour's cast; a tilted top stows its keyboard under the desk, so the desk user stays
where the keyboard was while the top was flat (`peopleState().tilt`); room chairs make way for a seated desk user's own
chair (1.3 m), for anyone standing within 600 mm, never for a seat somebody is on.

Checking a room: `node tools/rooms/room-stills.cjs <out> <room:layout:daypart> ... --port N --people --mode-height
--views asloaded,overview` (`asloaded` is the Studio's own opening view), `node tools/people/cast-audit.cjs --film`.


## People who move (added November 10, 2026, night)

`room-people-motion.mjs` (pure, tested without a browser) + `RoomPeople.cast()` / `chairOf()` in `room-people.mjs`.

- **The person at the featured desk is one person.** The models a cast puts there for one character (seated at 28 and 30 in, standing at 43.5 in) become one moving person, drawn skinned. When the desk sets off for a standing height they take their hands off the keys, roll the chair back, bring their feet under them, lean in and stand up, wait with their arms loose while the desk rises, and put their hands back on the keys as it arrives; the reverse when it lowers. Nobody fades and no `stand-wait` model is cast by hand any more (a hand-cast `…-stand-wait` extra of the same character with a `when` should be removed from a cut; `people.motion: false` on a chapter keeps the old still models).
- **Always there.** Between the built heights the forearms follow the keyboard (arm IK); a seated person follows it from 1.4 in below the lowest seated model to 2 in above the highest, a standing one from 6.5 in below the standing model. In between they stand by. A stopped desk leaves them standing by; a desk turned back before they are up sits them down again. A tilted top (more than 4°) takes the hands off the keys (and as the tilted top stows its keyboard, the person stays where the keyboard was while the top was flat). A wheelchair user stays seated at every height and takes their hands to their lap when the desk is out of reach; the short-statured user at the low setting stays standing.
- **What drives it.** Two numbers: `tau` (seconds into standing up, 0 to 2.6) and `k` (hands on the keys, 0 to 1). The pose is a pure function of `tau`, `k`, the desk height, a time and a seed (`solveDesk`). The desk moves `tau` and `k` by its height and by where it is travelling to (`stepDesk`): in the Studio once per frame with the live height and the lift's target; in the film and in Director `simulateDesk` runs the same steps over the chapter's desk track from its first second (`experience/stage.mjs` passes the track with the time: `setRoomPeopleTime(seconds, { seconds, heightAt, tiltAt })`), so a frame depends only on its second and scrubbing gives what playing gives.
- **Life.** Breathing, a drifting head with a glance down now and then, a slow shift of weight while standing (feet pinned), fingers tapping in bursts while the hands are on the keys. All from the time (chapter seconds in the film, a running clock in the Studio) and a seed. `people.life: false` on a chapter switches it off.
- **Everyone else** stays where they are but is alive too (`solveStill`): the same breathing, head and weight shifts; hands that rest on keys, a table, a bench or a stick stay exactly there; people at laptops and at the other desks type; a reader turns a page every 20 to 30 seconds; people looking at what they hold keep their eyes on it. Walkers are left as they are. For this a person is drawn skinned: in a film everyone in the shot, in the Studio the four nearest the camera besides the desk user (`LIVELY` in `room-people.mjs`; the choice is made again twice a second, and someone who drops out goes back to the posture as built). The Studio draws at full rate for 20 seconds after the last input while people are on, then at its idle rate (typing fingers pause at the idle rate, they would flicker).
- **A change of posture on the spot** (`solveChange`, `RoomPeople.pairUp()` / `changing()`). Two placements of one character at one spot (within 220 mm, facing the same way) are one person when one leaves as the other comes: in a film when their `when` windows meet (one ends within 0.75 s of the other's start), in the Studio when they are cast for different dayparts (`modes`) and the daypart changes. The person is then drawn whole and the bones turn from the first posture to the second over 1.4 s (2.4 s where they get up or sit down; hips first, then spine and head, arms last; feet that end elsewhere step there). What they hold appears and goes half way. Anything else (another spot, another character) still dissolves in the film and swaps in the Studio.
- **Walking (film only, a first version).** A standing person's placement can carry `walk: { path: [[x, z], ...] | to: [x, z], start: seconds, pace, then: '<model id>' }`: until `start` they stand at the head of the path, then walk it and stand at its end (in the posture of `then`, if given), facing along the path at both ends. `walkPlan` lays the footprints along the path once (step length from the leg length, about 1.8 steps a second); `solveWalk` poses any moment of it: a foot on the floor stays on its footprint (heel-off over the ball of the foot, heel first on landing) while the hips travel, so feet cannot slide, and the same second is always the same stride. No room uses it; in the Studio such a person stands at the start.
- **Bone data.** `assets/props/people-rigs/<character>.json` holds the bones' turns of every built posture of a character (47 KB each, loaded only for a desk user). `node tools/people/export-rigs.mjs` rewrites them from the GLBs; run it after `tools/people/build.py`.
- **The chair** rolls back 265 mm with its user, another 90 mm as they slide to the front of the seat, is nudged 150 mm further as they straighten, and comes back as they sit. A chapter's `people.chair` (`back`, `side`, `turn`) parks it elsewhere while they stand, as before.
- **Pose mode** works on a moving person: adjustments turn each bone from where the motion has it.
- Not yet: the people at the room's other desks do not stand up (those desks do not move); nobody walks in the Studio, and a walk does not yet end in a seat.
- Test: `npm run test:room-people-motion`.
