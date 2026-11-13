# People in every Studio room, by size and time of day (November 12, 2026)

Vico's request: several environments were sparsely populated ("like the government, and other larger spaces"); every
environment, room size and time of day should feel lived in, with the right kind of people (police, nurses and so on).

## What the Studio has now

Every room has a cast of its own (`ROOM_PEOPLE` in `room-people.mjs`). Before this, nine institutional rooms and the
classic library had one person at the mobile desk and nothing else, and the other rooms kept the same two or three
people whatever their size.

| Room | Busiest head count (largest size) | Notes |
|---|---|---|
| Government office | 18 | staff at every desk, the public at the counters, waiting seats, kiosk, consultations |
| Police | 16 | uniformed officers; briefing on the seats, case review, a thin night shift |
| Security operations | 10 | uniformed operators at the consoles, a handover at the incident board |
| Hospital | 14 | patients in the beds, doctors, nurses, visitors |
| Laboratory | 17 | a class in lab coats on the bench stools, staff at the instruments |
| Mobile IT | 11 | technicians at the benches, a queue at the tech bar |
| Middle school, College, University | 16, 15, 19 | lessons, seminars, an evening class, a presentation |
| High school (Studio only) | 17 | eight more students beside the film's |
| Classic library | 17 | readers at every table; one librarian at night |
| Library commons | 29 | the film's hall: readers and pairs down the cafe tables to the far end, visitors at the sculptures |
| Office, coworking, gallery, orbital deck, media lab | 9, 17, 14, 12, 13 | people are added with the floor area |
| Gym | 7 | people training on the machines (see below) |
| Workshop, lounge, kitchen and the private rooms | 3 to 10 | one or two more in the largest sizes |

Counts fall with the room size (a function of the layout's `index`, `tier(L)`) and with the hour: fewer in the evening,
one or two at night where the place is staffed at night, nobody where it is closed (office, coworking space, gym,
school rooms, the child's room).

## Characters

- 27 role characters (round 2): police `reyes`, `cole`, `brandt` (sergeant), detective `tran`; security `okoye`, `walsh`;
  nurses `nina`, `mateo`, `amara`; doctors `patel`, `stone`; patients `walter`, `june`; lab `vega`, `yusuf`, `chen`; IT
  `devi`, `tomas`; clerks `helen`, `darius`, `mei`; twelve-year-olds `aiden`, `bella`, `carlos`, `dina`, `emeka`, `fern`.
- Role postures: `stand-brief`, `stand-radio`, `stand-chart`, `push-cart`, `lie-bed`, `sit-microscope`, `stand-counter`,
  and `stand-mid` (a desk at 38 to 40 in) for everyone with a desk family.
- 18 everyday people (round 3): ten adults and eight students of 16 to 19.
- Where a squad or a ward needs more staff than there are role characters, earlier characters wear the role's colours
  (`LOOK.police`, `guard`, `scrubsTeal` / `Blue` / `Plum`, `labCoat`, `techPolo`).

The pipeline is described in `docs/people-and-window-views-20261110.md`.

## New in `room-people.mjs`

Placement:

- `at: [x, z], clear: true`: at that spot, or the nearest free place within about half a metre (none: not there).
- `toward: ['<id prefix>', ...]`: the nearest piece of furniture whose id starts with one of them (a chair's own table
  of the room's several).
- `rise: mm` with `seat`: a seat much higher than the pose was built for (bar and lab stools).
- `studio: true`: only in the Studio. Left out whenever a film casts the room.
- A seat the room has put away for the hour (chairs up on the tables after school) has nobody on it (Studio only).

Helpers for casts: `staffAt(L, rows)` (people at the layout's other desks; a desk the layout lacks has nobody),
`across(L, station, id, mm)` (a visitor on the far side of a counter), `besideStation(...)` (a speaker beside a lectern
that stands too close to the wall), `atTables(rows)`, `chat(L, across, deep, people)` (two or three talking in the open
floor, placed by fractions of the room), `deskCrew(who)` (the mobile desk's user at all four heights), `tier(L)`.

Loading: the Studio loads the people of the current time of day (and whoever is at the mobile desk) and brings the
others when the daypart changes (`bring`, `bringFor`, `waiting`). The large government office first loads 23 models,
not 51. A film, the Director and the review tools load the whole cast at once, as before.

## The film

Nothing in the film changes:

- Vico's own cut has no people. In the two cuts with people most chapters name a fixed list (`only`), which additions
  to the room do not touch.
- Two chapters take "everyone except" a few (the media lab in both cuts, the high school in the people cut). Additions
  to those two rooms are marked `studio: true`.
- `stand-mid` is not added to a film's desk families (`withFamilies` skips it when a film filter is set), so a desk
  passing 38 to 40 in shows what it showed.
- The seat-put-away rule and loading by the hour apply in the Studio only.

## Checking

- `tools/people/cast-audit.cjs '<room>:*:*'`: every size and time of a room. Its "hands off the keyboard" and "desk user
  inside a station" lines for the evening, night and party settings are an artifact of its own sequence: the user is at
  the desk (checked with a position read-out after the room settles).
- `tests/room-people-test.mjs`: every institutional cast (with the real layouts: nobody twice in a daypart, one person
  to a desk), loading by the hour, Studio-only people.
- The desk has 30 GB of memory: people builds with many Blender jobs and browser audits together ran it out twice.
  Builds use `--jobs 4`; audits run one room per GPU lock.

## Not in this change

- Six more children (Zuri, Hugo, Yuki, Karim, Lucia, Kian) joined later the same day: the kindergarten has 8 by day, the elementary classroom 8 to 10.
- People on the gym's equipment came the same evening: see "On the gym's equipment" below.
- The role garments are smooth shells with painted detail; real cloth assets would need a download.

## On the gym's equipment (November 12, evening)

The gym's people now train on its machines, and they move.

| Machine (from which size) | Who, when | Posture (`tools/people/cast.py`) | What moves |
|---|---|---|---|
| Training bike (house up) | Kai in the afternoon, Zoe in the evening (and the morning from the studio up) | `gym-cycle` | the feet go round with the crank, the bike's pedals turn with them |
| Rack's top bar (studio up) | Lin, morning and evening | `gym-pullup` | pull-ups: the body rises and sinks under the bar |
| Bench (studio up) | Andre in the morning, Ben standing by | `gym-press` | the dumbbells come down beside the chest and go up |
| Dumbbell rack (studio up) | Lin in the afternoon | `gym-curl` | one forearm up as the other goes down |
| Treadmill (the two largest) | Sofia in the morning, Andre in the afternoon and evening | their `stand-wait` model, `tread` | a brisk walk on the belt, on the spot |
| Heavy bag (the wellness suite) | Sofia in the evening | `gym-box` | two jabs and a breath |

How it is made:

- **Postures built on the machine.** Each `gym_*` posture in `cast.py` is written with the machine's own measurements
  (saddle, handlebar and crank; the bar's height; the bench's seat and the slope of its back pad; the bag's front), so
  hands and feet meet it whatever the person's size. They are role postures (built for those listed in `ALSO`, for
  anyone else on request). `held.py` has a `dumbbell`.
- **Placed by the machine's origin.** `{ by: '<machine>', reach, turn }` puts the person at the machine's own origin
  plus `reach` along its front, so a layout that moves the machine moves the person. `up: mm` stands someone on
  something (the treadmill's belt is 186 mm up).
- **Movement** (`room-people-motion.mjs`): `solveWorkout` works the exercise out from the one built moment (pure: the
  same second is the same pose; without life it is the model as built). `solveTread` is the walk's stride with the
  body where it is. `solveStill` hands a workout posture to `solveWorkout`, so the film and the Director can use these
  people like any other.
- **The bike's crank** (`gym-room.mjs`): axle, arms and pedals are a group named `Bike crank`; `RoomPeople.liven` turns
  it with the rider's feet (`turnCrank`) and puts it back when nobody rides.
- **Always moving.** In the Studio only the four people nearest the camera breathe and shift; whoever trains on a
  machine always moves (`RoomPeople.training`).
- **The bench.** Its back pad sloped the wrong way against its own rails (the high end at the seat); it now rises
  from the seat to the head end. This is the one change to the room itself, and it shows in every size from the
  house up, the film's gym included, when that chapter is rendered again.
- `tools/rooms/room-stills.cjs --frames n --every ms` takes several stills of a view a moment apart (to see movement).

The film: the gym chapter of the two cuts with people now names Kai on the bike as well (`only: [..., 'kai-bike']`,
he is in the opening shot), and the Studio's house gym has him there in the morning too (see "The film's chapters"
below).

Not done: rowing, a barbell squat (the bar is part of the rack), running rather than walking on the treadmill.

## Activities, laptops and the pottery wheel (November 12, night)

Vico: "have the characters go about doing an activity", "they should all have a laptop if they're doing that
activity", and in the artist's studio "a small ceramics corner" instead of the floor easel ("the desk replaces the
need for a painter's easel").

- **Laptops.** The `sit-laptop` posture now carries its own open laptop (`held.py` `laptop`, on the table under the
  hands, not in a hand). All 62 models were rebuilt. Before, none of the people in that posture had anything on the
  table (the people at the rooms' other desks type on those desks' keyboards and were fine).
- **Activities** (`room-people-motion.mjs` `ACTS`, run by `solveStill` on top of breathing and the drifting head, so
  the Studio and a film get them alike): the pen writes along a line and pauses (`sit-write`, the children's drawing
  postures), a raised hand stretches, sinks and waves (`sit-raise`), the brush paints and goes to the palette
  (`stand-paint`), a presenter's arm and head move (`stand-present`), a talker's hand talks (`stand-talk`), a drink
  is sipped (`stand-mug`, `stand-drink`, `sit-mug`, `sit-chat`), a gamer leans with the game (`sit-controller`), the
  tool hand works at the bench (`stand-work`), stretches are stretched (`stretch`, `stretch-open`, `floor-stretch`),
  a child sets pieces down (`kid-play-floor`). Each is worked out from the posture as built, seeded per person, pure.
- **The pottery wheel** (`artist-room.mjs`; every size but the nook): where the floor easel stood there is a wheel
  with a pot on it, a stool, a water bucket, a clay-spattered cloth, and a rack of ware by the wall (`ceramics-wheel`,
  `ceramics-rack`). The painting in progress leans under the window sill beyond the paint taboret, which stays by
  the desk. Lin throws a pot in the morning and the evening (`sit-pottery`, built on the wheel; her hands ride up and
  down the clay and the wheel head turns: `Pottery wheel head`). In the large rooms the corner is 0.4 m further back,
  clear of the worktable.
- **The film.** The artist chapter's room changes in all three cuts (its opening shot was on the easel; it is now on
  the wheel). In "Vico's cut with people" Lin is at the wheel; in the alternate cut she is at the wheel for the first
  14 s and paints at the tilted desk from 19.5 s as before (`people.only: ['lin-at-wheel']`). People in chapters
  rendered before this keep still hands and no laptops until the chapter is rendered again.

## Strolls (November 12, night)

Someone cast in the walking posture stood frozen in a stride in the Studio. They walk now (`RoomPeople.stroll`):
from where the room put them they take the longest clear stretch (their own heading first, then the other seven
directions; checked every 250 mm like a guest's free spot: walls, furniture, the desk and its user, loose chairs,
the others), up to 4.5 m, stop, look about, turn and come back, again and again. Under 1.5 m of clear floor they stay
as they were. The stride is the film's walk (`walkPlan` / `solveWalk`) between the character's `stand-wait`
posture at both ends. Strollers always move (they are not counted against the four lively people). A film is not
touched: its walkers have a path of their own (`walk` on the placement) and at a film's second a stroller stands
where the room or the cut has them. Today's walkers: Zoe in the media lab, Jo, Jack and Sara in the library hall.

## The film's chapters, and nobody sits on air (November 12, late night)

A look through every room chapter of "Vico's cut with people" with the activities in (six stills each):

- **Gym chapter**: Kai rides the bike (both cuts with people; the Studio's house gym in the morning as well, so the
  Studio and the film show the same morning).
- **Library chapter**: Zoe stood frozen in a stride in the opening shot. She is cast with a path now and walks
  (`cast: { key: 'zoe-walks', id: 'people-zoe-walk', at, turn, walk: { to, start: 0, then: 'people-zoe-stand-wait' } }`).
  A film's walker may be in the walking posture: `enliven` gives them their skeleton when the placement has a `walk`.
- **Seats** (`RoomPeople.clearChairs`, `ownChairs`, `sitter`). Since November 10 the room's chairs made way for anyone
  placed at a spot by hand ("a party guest by the desk"), which also took the chair from under people the cuts seat at
  a spot: Sofia and Kai at the table beside the library desk and Mia at that desk sat on air for most of the chapter.
  Now someone in a seated posture (`sit-*`, not `sit-floor`) keeps the chair that is there, and if a ray down through
  their pelvis meets nothing of the room between 250 and 700 mm they get a task chair of their own, under them and
  facing their way (it comes and goes with them, like a desk user's). Someone standing where a chair is still clears
  it. Checked in the library chapter (both cuts), the alternate cut's classroom (the students keep the classroom
  chairs) and the gaming chapter (Kai on the sofa gets no chair).
- The other chapters keep their casts: their people already move with what they do (writing, typing on a laptop that
  is now there, bench work, the game).
- `tools/experience/render-cut.cjs --list-objects '<regex>'` marks objects that are switched off with `(hidden)`.

