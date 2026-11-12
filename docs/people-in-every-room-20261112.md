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
| Library commons | 25 or so by day | the film's hall: readers down the cafe tables to the far end |
| Office, coworking, gallery, orbital deck, media lab | 9, 17, 14, 12, 13 | people are added with the floor area |
| Gym, workshop, lounge, kitchen and the private rooms | 3 to 10 | one or two more in the largest sizes |

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

- More children (the kindergarten, the elementary classroom and the child's room draw on eight).
- Poses on gym equipment (cycling, running, lifting): the larger gyms have people warming up beside it.
- The role garments are smooth shells with painted detail; real cloth assets would need a download.
