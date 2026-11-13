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


## The living and working rooms (November 11)

The study, office, kitchen, lounge, bedroom, gallery, coworking space and orbital deck had one person each: whoever is
at the desk. They keep that person and now have the people their furniture is there for, by the hour:

| Room | Morning | Afternoon | Evening | Night | Party / social |
|---|---|---|---|---|---|
| Study | | | Grace reads in the leather armchair | | Grace talks from the armchair, Hale has come by with a mug (not in the smallest study) |
| Office | Rosa with a mug at the coffee bar | Lin reads on the sofa | Hale takes a call by the credenza | closed | Lin on the sofa, Rosa and Hale round the coffee table |
| Kitchen | Andre with a mug at the table | | Grace cooks at the island (at the counter where there is none) | | Andre, Rosa and Hale at the table, Grace by the coffee bar |
| Lounge | | | Zoe reads on the sofa | Zoe and Kai on the sofa (movie night) | Kai and Sam with controllers, Eli watching from the end of the sofa with a drink (not in the smallest lounge) |
| Bedroom | | | Ava reads in the armchair | | Ava talks from the armchair, Zoe by her on her phone |
| Gallery | | Hale rests on the bench, Jo before the Thinker | Ben by the vase | closed | Rosa, Andre and Grace round the bench |
| Coworking | Hale with a mug at the cafe counter | Rosa and Sam work at the meeting table | Jo reads on the sofa | closed | Jo on the sofa, Hale and Rosa round the coffee table, Sam at the counter |
| Orbital deck | Priya at the service counter | | Kai briefs at the mission console | | Priya and Kai at the console (Priya only on the smallest deck) |

Everyone is placed by a piece of the room's furniture, so they follow it when a layout or an hour moves it. The
smallest layouts lack some of it and are cast on what they have: an armchair for the office sofa, the banquette for
the kitchen's dining chairs (two at its table, Grace standing by it), the bench at the foot of the bed for the bedroom armchair, a lounge chair for the
coworking sofa. Eleven models were built for these casts (the library has 672).

Two placement rules were added in `room-people.mjs` for this:

- `toward: '<prop id>'` with `on`: of the four ways a seat can be sat on, the person takes the one facing that prop
  (a chair faces its table, a sofa its coffee table). Chair models do not agree on which way is their front.
- `clear: true` with `by` or `around` (the helpers `standBy` and `standRound`): the person takes the nearest spot along
  or round that prop where a standing person is clear of the furniture (260 mm), the walls, the desk and the place of
  whoever is at it, and anyone else there at that hour (650 mm). A fixed angle that suits one size of a room put guests
  in a sculpture, a drafting station and through a wall in other sizes. With nowhere free the person is not shown.
  The spot is chosen when the room is built and again when the hour changes; furniture the user moves in between does
  not move the guest until then. Casts written before this (the film rooms, the school rooms) do not use it and stand
  where they stood.

`tools/people/cast-audit.cjs` now measures people as they are posed. It used to read the stored (bind pose) vertices of
a skinned model, which made every person about 2 m tall: it over-reported seated people as outside the room and as
touching furniture, and its "hands off the keyboard" distances were not real.

## People who move (added November 10, 2026, night)

`room-people-motion.mjs` (pure, tested without a browser) + `RoomPeople.cast()` / `chairOf()` in `room-people.mjs`.

- **The person at the featured desk is one person.** The models a cast puts there for one character (seated at 28 and 30 in, standing at 43.5 in) become one moving person, drawn skinned. When the desk sets off for a standing height they take their hands off the keys, roll the chair back, bring their feet under them, lean in and stand up, wait with their arms loose while the desk rises, and put their hands back on the keys as it arrives; the reverse when it lowers. Nobody fades and no `stand-wait` model is cast by hand any more (a hand-cast `…-stand-wait` extra of the same character with a `when` should be removed from a cut; `people.motion: false` on a chapter keeps the old still models).
- **Always there.** Between the built heights the forearms follow the keyboard (arm IK); a seated person follows it from 1.4 in below the lowest seated model to 2 in above the highest, a standing one from 6.5 in below the standing model. In between they stand by. A stopped desk leaves them standing by; a desk turned back before they are up sits them down again. A tilted top (more than 4°) takes the hands off the keys (and as the tilted top stows its keyboard, the person stays where the keyboard was while the top was flat). A wheelchair user stays seated at every height and takes their hands to their lap when the desk is out of reach; the short-statured user at the low setting stays standing.
- **What drives it.** Two numbers: `tau` (seconds into standing up, 0 to 2.6) and `k` (hands on the keys, 0 to 1). The pose is a pure function of `tau`, `k`, the desk height, a time and a seed (`solveDesk`). The desk moves `tau` and `k` by its height and by where it is travelling to (`stepDesk`): in the Studio once per frame with the live height and the lift's target; in the film and in Director `simulateDesk` runs the same steps over the chapter's desk track from its first second (`experience/stage.mjs` passes the track with the time: `setRoomPeopleTime(seconds, { seconds, heightAt, tiltAt })`), so a frame depends only on its second and scrubbing gives what playing gives.
- **Life.** Breathing, a drifting head with a glance down now and then, a slow shift of weight while standing (feet pinned), fingers tapping in bursts while the hands are on the keys. All from the time (chapter seconds in the film, a running clock in the Studio) and a seed. `people.life: false` on a chapter switches it off.
- **Everyone else** stays where they are but is alive too (`solveStill`): the same breathing, head and weight shifts; hands that rest on keys, a table, a bench or a stick stay exactly there; people at laptops and at the other desks type; a reader turns a page every 20 to 30 seconds; people looking at what they hold keep their eyes on it. Walkers are left as they are. For this a person is drawn skinned: in a film everyone in the shot, in the Studio the four nearest the camera besides the desk user (`LIVELY` in `room-people.mjs`; the choice is made again twice a second, and someone who drops out goes back to the posture as built). The Studio draws at full rate for 20 seconds after the last input while people are on, then at its idle rate (typing fingers pause at the idle rate, they would flicker).
- **A change of posture on the spot** (`solveChange`, `RoomPeople.pairUp()` / `changing()`). Two placements of one character at one spot (within 220 mm, facing the same way) are one person when one leaves as the other comes: in a film when their `when` windows meet (one ends within 0.75 s of the other's start), in the Studio when they are cast for different dayparts (`modes`) and the daypart changes. The person is then drawn whole and the bones turn from the first posture to the second over 1.4 s (2.4 s where they get up or sit down; hips first, then spine and head, arms last; feet that end elsewhere step there). What they hold appears and goes half way. Anything else (another spot, another character) still dissolves in the film and swaps in the Studio.
- **Walking (film only, a first version).** A standing person's placement can carry `walk: { path: [[x, z], ...] | to: [x, z], start: seconds, pace, then: '<model id>' }`: until `start` they stand at the head of the path, then walk it and stand at its end (in the posture of `then`, if given), facing along the path at both ends. `walkPlan` lays the footprints along the path once (step length from the leg length, about 1.8 steps a second); `solveWalk` poses any moment of it: a foot on the floor stays on its footprint (heel-off over the ball of the foot, heel first on landing) while the hips travel, so feet cannot slide, and the same second is always the same stride. The library chapter's Zoe uses it (in the walking posture, which a film's walker may be in since November 12); in the Studio such a person stands at the start (a Studio walker without a path strolls: `docs/people-in-every-room-20261112.md`).
- **Bone data.** `assets/props/people-rigs/<character>.json` holds the bones' turns of every built posture of a character (47 KB each, loaded only for a desk user). `node tools/people/export-rigs.mjs` rewrites them from the GLBs; run it after `tools/people/build.py`.
- **The chair** rolls back 265 mm with its user, another 90 mm as they slide to the front of the seat, is nudged 150 mm further as they straighten, and comes back as they sit. A chapter's `people.chair` (`back`, `side`, `turn`) parks it elsewhere while they stand, as before.
- **Pose mode** works on a moving person: adjustments turn each bone from where the motion has it.
- Not yet: the people at the room's other desks do not stand up (those desks do not move); nobody walks in the Studio, and a walk does not yet end in a seat.
- Test: `npm run test:room-people-motion`.

## Children (November 11)

The child's room, the kindergarten and the elementary classroom had nobody in them: every character was an adult or a
teenager. There are now eight children, each about as tall as a child of that age:

| Child | Age | Height |
|---|---|---|
| Tess | 4 | 103 cm |
| Milo | 5 | 108 cm |
| Lila | 6 | 115 cm |
| Ravi | 7 | 122 cm |
| Theo | 8 | 129 cm |
| Ines | 9 | 134 cm |
| Nora | 10 | 138 cm |
| Jun | 10 | 138 cm |

They have ten postures of their own (`kid-…` in `tools/people/cast.py`), built on child furniture and scaled with the
child: playing, sitting and reading on the floor, kneeling at a low craft table, standing, waiting, standing at the desk
on its lowest setting, sitting at the desk on the room's stool, and sitting at the kindergarten table (260 mm seats) and
the elementary pods (360 mm seats). (Heights as the Director shows them, to the top of the hair.) Every child is built in all ten; the casts use nine of
them so far (kneeling at the craft table is in the library for the Director), and only Nora and Jun sit at the desk.
Adult postures are not built for children and child postures not for adults; the
Director's posture menu shows each kind its own, and swapping a child for an adult (or back) picks a posture of that kind.

Who is in the room, by hour:

- **Child's room** follows the age stage of the layout. Toddler stage: Tess plays on the mat in the morning, draws
  standing at the desk in the afternoon, has a story with a grown-up on the play mat in the evening, a friend comes to
  play at the party. Primary: Nora is on her feet at the desk in the morning getting her things together, does homework
  there on the room's own chair, reads on the floor, builds with Jun. Pre-teen: Jun, the same day, with Ines over. High school and college stages use the teenage and young adult characters at
  the desk. Nobody is shown at night up to the high school stage (asleep); the college student is still at the desk.
- **Kindergarten**: circle time on the rug with the teacher in the rocker; children at the table, the easel, the
  teacher at the desk; a parent and child at the family evening; nobody during the reset.
- **Elementary**: readers on the meeting carpet; children at the pods and one at the science window; a parent, a child
  and the teacher in the evening; the teacher alone at night; the class on its feet at the workshop.

Three things were added for this:

- `chair: false` on a desk placement (`room-people.mjs`; implied by a `kid-sit-desk` model, so a film or the Director
  placing one needs no flag): the child sits on the room's own kind of seat. The room keeps
  its study chair where its story has it (pushed back, turned away from the desk), so the seat under the child is a copy
  of it, under them and facing the desk with them, while the room's chair is hidden. The room's chair is never moved:
  nothing the Studio saves about the furniture changes, and it is back when the child leaves or People is turned off.
- The child room's study chair itself now faces the desk (`child-room.mjs`: the backrest was on the desk side, so the
  empty chair stood with its back to the desk; the clothes over its back moved with it in `child-lived-in-detail.mjs`).
  That chair is built facing the desk as it stands (-z) and says so (`userData.seatFront = '-z'`), so its copy is
  turned half a turn from the child; library chairs (the task chair of any other room) are built facing +z like the
  people and their copy is not turned. While a child sits, the clothes over the chair back are not shown (they stay
  on the room's hidden chair).
- `around: ['<prop id>', degrees, mm]`: round a rug, a mat or a table, facing its middle, wherever the room has put it.
- A child drawing at the desk keeps their hands on a tilted top (up to 12 degrees, in the Studio and along a film's
  desk track; the hands are where the flat top was, a few centimetres off at the far edge of a 12 degree tilt): the
  "hands leave the keys when the top tilts" rule of the typing postures does not apply to them
  (`room-people-motion.mjs`). In the Director's People tab, Women and Men include the girls and the boys.

Checked with `tools/people/cast-audit.cjs` over every layout and hour of the three rooms (nobody outside the room,
nobody through furniture), and by eye for anyone seated the wrong way round on a chair (the kindergarten teacher's
rocker faces the rug, so she is not turned on it as people on the classroom chairs are).

## People of the institutional rooms (12 November)

The police squad room, the hospital, the laboratory, the IT room, the government office and the middle school have
people of their own in `tools/people/cast.py`: Officers Reyes and Cole, Sergeant Brandt, Detective Tran, Okoye and Walsh
(security), the nurses Nina, Mateo and Amara, Dr Patel and Dr Stone, the patients Walter and June, Vega, Yusuf and Chen
(laboratory), Devi and Tomas (IT), the clerks Helen, Darius and Mei, and six students of 12 to 13 (Aiden, Bella, Carlos,
Dina, Emeka, Fern). The catalog gives each a `role`; the students are `teen` and take the adults' postures.

MakeHuman has no scrubs, coat or gown, and nothing to hang on a uniform, so a character can name:

- `wear`: garments cut from the base mesh's own helper geometry (`tools/people/garments.py`): `coat`, `scrubs`, `gown`,
  `socks`, and `gloves` (the hands' faces in a second material). They are weighted like the body, so they follow every
  posture. MPFB keeps the phenotype as shape keys on the base mesh: the copy a garment is cut from has them mixed down
  first (edited with the keys on, the armature deforms the keys' mix and the garment ends up inside the body in some
  builds and not in others).
- `gear`: what the role wears on the body (`tools/people/worn.py`): `belt` (with `radio`, `pouch`, `cuffs`, `light`,
  `keys`, `tools`, `badge` at an angle round the waist), `badge`, `nameplate`, `shoulder_patch` (with `chevrons`),
  `shoulder_mic`, `chest_patch`, `back_text`, `lanyard`, `id_badge`, `stethoscope`, `hip_badge`. Each is described on
  the rest pose and dropped onto the posed clothes with a ray.
- `tuck` (a top ends under the belt), `frames` (glasses lose their lenses: safety glasses), `carry` (held in one
  posture), `postures` (what the library holds of the character; `build.py --all` builds only those, any other on
  request).

Recolouring (`colors` on a placement): the shirts, the scrubs top and the gown are the `top`, trousers the `bottom`,
Walter's socks the `shoes`. The white coat (`Worn.coat`), the gloves and everything in `gear` (`Held.*`) keep their colour.

Postures the roles brought (anyone can take them: `python3 tools/people/build.py people-<character>-<posture>`):

| Posture | Built on |
|---|---|
| `stand-mid` | a desk at 39 in (keys 0.974 m): the stations that stand at 38 to 40 in. `deskFamily` loads it with the other desk postures. |
| `stand-brief` | nothing: at ease, thumbs at the belt (the hands are moved out to this character's waist: `clear` on a hand) |
| `stand-radio` | nothing: a handheld radio upright at the left collarbone, head turned to it |
| `stand-chart` | nothing: a clipboard on the left hand at chest height, a pen in the right |
| `push-cart` | a handle 0.95 m up, 0.48 m in front of the pelvis, hands 0.4 m apart; mid-step, so it does not breathe and shift |
| `lie-bed` | the hospital's `care-bed-N`: linen top 663 mm, back section raised 19 degrees from a hinge 80 mm behind the pelvis, head and shoulders on the pillow. Not dropped to the floor: place it `on: 'care-bed-N'` with `depth: -170` (the pelvis 170 mm toward the head from the bed's middle). |
| `sit-microscope` | a stool 0.65 m high, feet on its ring 0.25 m up; eyes 1.2 m up and 0.40 to 0.44 m in front of the pelvis, hands at 0.97 m, 0.55 m in front. Not dropped to the floor either. |
| `stand-counter` | a counter 1.05 m high whose near edge is 0.27 m in front of the pelvis; hands 0.44 m in front |

`build.py --who a,b` and `--pose p,q` narrow `--all`. Builds here run with `--jobs 4`: nine Blender processes beside a
browser audit ran the machine out of memory.

## More everyday people (12 November, round three)

Rooms hold up to 19 people at once and the 11 everyday adults and 8 teenagers ran out. Eighteen more, all in
`tools/people/cast.py`:

| Adults | | Students (16 to 19) | |
|---|---|---|---|
| Elena | woman, 45, striped blouse | Nia | girl, 17, curls, yellow T-shirt, backpack |
| Kofi | man, 32, striped shirt; also in a wheelchair | Max | boy, 18, blond, green long sleeves |
| Mina | woman, 28, fringe, flowered trousers | Yara | girl, 19, long hair, coral sweater, backpack |
| Raj | man, 55, suit and tie, glasses | Finn | boy, 16, red hair, red T-shirt, backpack |
| Sara | woman, 35, headscarf | Suki | girl, 17, lilac T-shirt |
| Tom | man, 68, field jacket; also with a walking stick | Diego | boy, 19, grey long sleeves, backpack |
| Ivy | woman, 60, plum trouser suit, glasses | Amal | girl, 18, striped blouse and jeans |
| Luca | man, 28, dark green T-shirt | Jack | boy, 19, white T-shirt, backpack |
| Bruno | man, 48, heavy build, red polo shirt | | |
| Dee | woman, 25, athletic, coral T-shirt and leggings | | |

Each is built in the postures a room's hours ask for (`CROWD` in `cast.py`: the desk family at 28, 30, 35.5, 39 and
43.5 in, standing by, talking, on the phone, presenting, at a bench, with a mug or a drink, walking, and seated writing,
listening, at a laptop, reading, on the phone, chatting); the students also with a hand up; Kofi in `wheel-type`
(28 and 31 in) and `wheel-watch`; Tom in `cane-stand`. The backpacks are worn in `walk`.

What a character can now say besides the MakeHuman phenotype (all in `build_people.py`):

- `face`: MakeHuman's detail targets by name with a weight (`'nose-hump-incr': .4`; `'lr-cheek-bones-incr'` is the left
  and the right target of a pair). An unknown name stops the build.
- `skin_tone`: a factor per channel on the skin texture. The asset packs have a pale and a dark skin set and little
  between; `(.8, .66, .55)` on a pale skin is a mid brown, `(1.4, 1.34, 1.28)` lightens a dark one.
- `parts`: `{outfit: 'top' | 'bottom' | 'both'}`. The one-piece outfits (`male_casualsuit02` to `06`,
  `female_casualsuit01/02`, `female_elegantsuit01`, `female_sportsuit01`, the `toigo_*_suit`s) are a top and a bottom
  that do not touch: `'bottom'` keeps the jeans for under another shirt, `'top'` the shirt for over other trousers,
  `'both'` wears it whole and gives the bottom half a material of its own (`Human.<outfit>_pants`), so the Studio
  recolours top and bottom as two garments. (`male_casualsuit01` and the overalls are one piece and cannot be split.)
- `dye`: `{garment: colour}`, and `'<outfit>:bottom'` for the bottom half of an outfit worn whole. Unlike `tint`, which
  flattens the fabric to one colour, a dye keeps stripes, prints, seams and the pale wear of denim.
- `wear: [('headscarf', {'color': ...})]` (`garments.py`): a wrapped headscarf laid over the head, the neck and the
  clothes, open round the face. Its material is `Human.headscarf_hair`: a placement's `colors.hair` recolours it.
- `look: 3`: this round's material handling. The MakeHuman logo is taken off the chest of the four T-shirts that
  carry it, a tint or dye goes to the fabric's colour texture where an ambient occlusion map is mixed over it, a height
  map is no longer exported as a normal map (it turned the tucked T-shirt nearly black), and skin is only removed where
  a whole face is under cloth or has come through it (no notches of missing neck along a collar). People built before
  this round do not have the key and build as they did.

## A better look for the people who were already there (12 November, round three, part B)

Every character now builds with `look: 3` (set for all at the end of the character list in `cast.py`). Ids, postures,
sex, age, heritage, build and height are as they were. What changed:

- **Faces.** The people of rounds one and two were MakeHuman's average face for their sex, age and heritage, so several
  were near twins. `own_face(name, age)` gives each a head shape, one trait each for the nose (two), cheeks, chin, mouth,
  eyes or brows, ears or forehead, and one small asymmetry, picked by the name and kept moderate; from the fifties on,
  bags under the eyes and the corners of the mouth, from the seventies a fuller neck. A `face` written on a character
  replaces it (Sergeant Brandt has one).
- **Eyes.** The eye texture is reworked per model (`eye_image`): the white is shaded toward the lids and slightly warm,
  the iris has a dark rim, the reddish "brown" iris is brown; the eyeball is less glossy (roughness .3, was .12).
- **Brows** keep more of their soft edge (alpha cut-off .3, was .4: they were drawn lines) and take the hair's colour
  (`brow_tint` where the hair keeps its own texture).
- **Hair.** A hair colour (`hair_tint`) no longer flattens the texture to one tone (`hair_image`): strands stay darker
  and lighter than the colour, the lightest catch the light, and black is a tenth grey, not zero. Two hair assets came
  with object-space normal maps, which glTF reads as tangent-space: the messy short hair (Sam, Chen, Aiden) was grey
  patches. Those maps are dropped.
- **Skin** is less glossy (roughness .7, was .58). Women and girls on the pale skin sets get a little warmth; people
  whose heritage lies between the pale and the dark sets get a `skin_tone` (Omar, Priya, Leo, Sofia, Rosa, Officer
  Reyes, Dr Patel, Vega, Yusuf, Devi, Mateo, Bella, Carlos, Dina, Ravi, Ines).
- **Clothes.** The tucked T-shirt (Maya, Zoe, Lin, Rosa, Ava, Sofia, Tess, Milo, Ines) was exported with its height
  map as a normal map and came out nearly black whatever its colour: it now has the colour `cast.py` gives it. The
  MakeHuman logo is off the chest of Aiden's and Fern's T-shirts. Collars have no notches of missing neck, and the
  flecks of trouser along the hem of a sweater or a T-shirt are gone (Grace, Mia, Nora, Emeka): a corner of skin or
  of an under-garment that pokes through the layer over it is tucked back under it (`cull_under(..., tuck=True)`),
  where a whole face used to be removed or left; the hands are never touched. Kai and Mia wear
  jeans, Theo a T-shirt and jeans; Noah, Sofia, Carlos and Ines have a stripe woven into their top (`stripes`:
  bands by height on the body as it stands, so they run level across seams). Darius' tint, which never reached his
  denim, is gone.
- **Hair styles.** Where five shared one: Eli (wavy), Cole, Mateo, Darius, Emeka, Carlos, Bella, Dina, Fern.
- **In bed.** `people-grace-lie-bed` and `people-ben-lie-bed` wear a gown (`cast.VARIANTS`: an outfit of its own
  for one model).

`_ROUND3` in `cast.py` lists the per-person changes: remove a line and that person is dressed and combed as before.
Before and after, same camera: `node tools/people/before-after.mjs --before <folder with the old assets/props>
--after . --ids people-maya-stand-wait,... --out sheet.png` (three.js in headless Chrome, as the Studio draws them;
each model whole at room distance and close on the face, old next to new). The old models come out of git:
`git show <commit>:assets/props/<id>.glb`.

## Six more children (12 November, round three, part C)

| Child | Age | Height |
|---|---|---|
| Zuri | 4 | 104 cm |
| Hugo | 5 | 111 cm |
| Yuki | 6 | 115 cm |
| Karim | 7 | 124 cm |
| Lucia | 8 | 129 cm |
| Kian | 10 | 139 cm |

In `cast.CHILDREN`, so the catalog marks them `child` and they are built in the ten `kid-` postures like the other
eight (`people-<name>-kid-<posture>`). `tests/room-people-test.mjs` names the children in a regular expression where it
checks that the children's rooms are cast with children: a room that casts one of the six needs the name added there.

## On the gym's equipment (12 November, evening)

Postures `gym-cycle`, `gym-pullup`, `gym-press`, `gym-curl` and `gym-box`, built on the gym's machines and moving
(pedalling, pull-ups, presses, curls, jabs), a walk on the treadmill's belt, and a `dumbbell` to hold. Described in
`docs/people-in-every-room-20261112.md`, "On the gym's equipment". After building or rebuilding any of them run
`node tools/people/export-rigs.mjs <character>`: the movement reads the bones from there.

