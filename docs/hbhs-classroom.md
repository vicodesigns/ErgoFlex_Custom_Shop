# High school: Huntington Beach High School concept — October 13, 2026

The **High school** stage (Scenes → Educational → School stage → High school)
is now a "Surf City" science and media classroom **inspired by Huntington
Beach High School** (HBHS, Huntington Beach, California). It is an
inspired-by concept, not a measured replica of a real HBHS room. It is not
affiliated with the school or its district and uses **no official marks**:
no logo, crest, script wordmark or monogram. All wall text, data and schedules
are generic and labelled *sample* where they look like data.

Concept line: **"Surf City physics: from derricks to waves."** The physics and
energy classroom keeps its teaching purpose. Its energy story runs from the
1920s oil field (the source of the Oilers nickname) to waves, wind and sun on
the coast. One desk serves the school's performing-arts and media students
(APA / MMET), a spirit wall is done in Oiler orange and black, and the window
looks out at a stylised 1926 bell tower.

## Where it lives

- Code: `institutional-education.mjs` (`STAGES.highschool`, `LIGHT.highschool`,
  `VIEWS.highschool`, `WALLS`, `BUILD`, `DECOR` and `FIXTURES` entries, the
  board and screen drawings, `stationDetail`, `activityMaterials`).
- Shared one-row entries: `room-desk-styles.mjs` (Oiler black & orange: Black
  Birch top, White base, `#e8702a` trim), `scene-screens.mjs`,
  `room-activity-print.mjs` and `room-finish-palettes.mjs`.
- `stationChair()` in `institutional-scenes.mjs` accepts an optional
  `chairId` for station chairs.
- Caption: *Surf City science and media classroom · inspired by Huntington
  Beach High School.*

## Identity

| Element | Treatment |
| --- | --- |
| Colours (approximate; no official values found) | Oiler Orange `#e8702a`, deep orange `#d45f1e`, Oiler Black `#1d1d1f`, charcoal `#35383b`, Tower Plaster `#ece4d3`, roof tile `#b4583a`, Pacific blue `#2e6f8e`, sea glass `#9cc3b6` |
| Text | OILERS, GO OILERS, HOME OF THE OILERS, HBHS, SURF CITY, EST. 1906. "Huntington Beach High School" appears once, as the caption of the bell-tower print |
| Motifs | Waves and pier pilings lead. A generic lattice derrick appears only small, inside information graphics (board timeline, screen icons, one poster), never as an emblem. A pumpjack appears as desk models |
| Typography | Heavy varsity block lettering on canvas (`varsity()`); italic serif for the print caption |

## Room by zone

- **Teaching wall:** whiteboard *ENERGY · WAVES · CHANGE* (sine wave with λ, A
  and v = f · λ; a wave shoaling between pier pilings; a 1920 → today energy
  timeline), with a different strip per activity (warm-up question, wave-lab
  data table, homework, lesson outline, showcase rubric). Also a periodic
  table, a *FROM DERRICKS TO WAVES* energy-flow poster, a framed bell-tower
  line drawing with a picture light, an orange-bezel clock and a Lombard-band
  arcade frieze along the top.
- **Wave and energy demonstration desk** (60x30, facing the class): a wave
  tank with paddle, pier dowels and beach slope, and a pumpjack model on the
  raised shelf; oscilloscope trace, trolley track and laptop.
- **Teacher corner:** the science and media teacher's desk with a calendar,
  pencil cup and picture frame; an OILER BELL SCHEDULE (blocks only, *sample*),
  the lab safety poster, OILERS and SURF CITY pennants, a tall plant, a bin and
  a conference chair.
- **Paired rows:** 9 tables and 18 chairs (one in three in orange), black edge
  bands, worksheets and calculators; an orchestra student's violin on one table.
- **Lab bench and door wall:** charcoal HPL bench with a black epoxy top and
  stainless sink, castored stools, a handout tray, goggles rack and eyewash
  sign; charcoal felt acoustic panels with APA, MMET and orchestra posters;
  the presentation display; a WAVES · TIDES · SWELL · WIND · SOLAR · OIL TO
  ENERGY poster gallery; an orange *214* room plaque and the *SCIENCE 214 ·
  SURF CITY* sign; black-and-orange lockers with a vertical OILERS stencil;
  trash and Pacific-blue recycling bins.
- **Window desks:** the coastal research nook and the accessible student desk
  (28 in, wheelchair).
- **Spirit wall** (window wall, front bay): a HOME OF THE OILERS felt banner,
  a surf-team longboard on brackets, and a lit glass trophy shelf (two cups, a
  volleyball, a fin trophy and a LEAGUE CHAMPIONS plaque). A small bookshelf
  under it holds APA scripts and scores.
- **Front:** the APA set and costume design review desk (43.5 in, 25° tilt,
  drafting board, set-design sheet, costume swatches and a set model) with a
  tall drafting chair, and the MMET media desk (wide monitor, nearfield
  speakers, keyboard, mouse, drawing tablet, camera, audio interface,
  sheet-music folder, production PC beside it).

Walls: charcoal dado to 900 mm, a 10 mm orange cap rail, a 300 mm charcoal
felt tack strip with pinned notices (SURF CLUB, APA AUDITIONS, LAB 4, GO
OILERS), and limewashed Tower Plaster above. Floor: driftwood oak planks.
Window frames are dark bronze and the door frame black.

**Window view:** a stylised bell tower and auditorium (cream plaster,
corbel band, round-arched belfry, terracotta cap), a flat-roofed 1970s
classroom wing with orange doors, Mexican fan palms, a sun-bleached quad,
stadium light standards and a tiny distant pumpjack. There is no ocean: the
campus is roughly 2 km inland.

## Activities and light

Five real lights at most: 3 room lights plus the planning-table lamp (4 in
use). Everything else is emissive or an additive pool.

| Activity | Light and staging |
| --- | --- |
| First bell (morning) | Marine-layer stratus, no sun disc, fixtures on; agenda slide; attendance clipboard and bell-schedule card |
| Wave lab (afternoon) | Crisp sun and a clear floor patch; swell-forecast chart (*sample data*); data sheets and a stopwatch |
| After-school study (evening) | Pacific sunset, long orange patch, tower tinted; chairs up on alternate tables; tide curve; sheet-music binders and a music stand |
| Lesson planning (night) | Floodlit tower and field lights outside; warm islands at the bell schedule, tower print and trophy shelf; graded notebooks |
| Oiler showcase (party) | OILER SHOWCASE slide; orange, black and cream pennant strings on the back, door and window walls; judging sheets and rosettes; deep-orange desk LEDs |

## Sources

Research summary from the design brief. Colour values, the plaster and tile
colours, the tower's arch details and the window geography are stylised
assumptions, not facts.

- Huntington Beach High School: https://en.wikipedia.org/wiki/Huntington_Beach_High_School
- HBHS official site: https://www.hboilers.com/
- Bell tower history (Sun News): https://www.sunnews.org/a-history-of-the-huntington-beach-high-school-bell-tower/
- SoCal Landmarks: https://socallandmarks.com/index.php/2023/01/16/huntington-beach-high-school
- ENR, auditorium and bell tower renovation: https://www.enr.com/articles/33279-huntington-beach-union-high-school-district-auditorium-and-bell-tower-renovation
- HB Slick, the auditorium at 100: https://hbslick.com/13510/arts-entertainment/century-of-stars-and-stories-celebrating-100-years-of-the-hbuhsd-auditorium/
- Huntington Beach Academy for the Performing Arts: https://www.hbapa.org/
- Surf team (Victory Journal): https://victoryjournal.com/stories/the-dawn-patrol/
- Huntington Beach Oil Field: https://en.wikipedia.org/wiki/Huntington_Beach_Oil_Field
- Marine layer: https://en.wikipedia.org/wiki/Marine_layer

Deliberately left out: official logos and marks, any real person's name
(including the auditorium's dedicatee), the surf team's disputed founding
year, league marks and real show titles.

## Verification (13 October 2026)

- Review renders: `node tools/props/institutional-review.mjs --only highschool --reference none`
  (15 views: wide, hero and reverse for all five activities), plus close-ups
  of the spirit wall, demonstration desk, window view, teacher corner, door
  wall and chairs up. Kindergarten and middle-school chairs-up close-ups were
  checked after the shared `E.chairUp` change.
- `tests/institutional-room-test.cjs --only=highschool` (and `middleschool`,
  `kindergarten`) stops at the station-collider wait in this build. Stations
  are now adopted as scene desks (`sceneDeskId`) and are no longer in
  `roomInteractions.entries`, so the wait never completes for any stage with
  stations (middle school fails the same way). A copy of the test with that
  wait pointed at the station assets passes highschool, middleschool and
  kindergarten: bounds, sizes, overlaps, 1–2 local lamps, the 28 in accessible
  desk and all five Groove plans. Two other failures involve parts this change
  does not touch: the kindergarten painting-easel scene desk's height, and the
  final project round-trip room count (13 vs 12).
- `tests/room-desk-styles-test.cjs --only highschool`: the highschool palette
  applies, and its activities and daily kit pass. The shared-build precedence
  check and the "artwork overwritten" check fail for unchanged scenes too.
- The layout checker (`docs/environment-briefs/layout-check/check.mjs`) reports
  only the intended close fits: bin and chair beside the teacher desk, stools
  at the bench, the PC beside the MMET desk, the plant by the bench, 870 mm
  row spacing with chairs out, and the bookshelf near the planning table. The
  door path is clear.

## Second expert review and polish

An independent panel signed the classroom off with polish. Applied: a true
longboard planform (round nose, squared tail, nose rocker); a softer
presentation-screen halo after dark; a clearer First bell/Wave lab contrast
(stronger afternoon sun patch, softer marine-layer morning); the supplied
upright plant in the teacher corner; a lighter rug under the black desk; and
rounded bags in the school palette on chair backs.

Test maintenance: `tests/institutional-room-test.cjs` waited for station
colliders that scene desks now own, had no characteristic furnishing for the
OCC lab and still expected 12 institutional rooms; all three failed on the
unmodified code and are corrected. A kindergarten easel height check and the
room-desk-styles shared-build precedence check also fail on the unmodified
code and are left for their owners.
