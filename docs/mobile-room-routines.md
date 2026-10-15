# Mobile workspace routines

The existing time and activity buttons now suggest a room-wide mobile desk
routine. Choose an activity, then **Start room routine**. Time selection still
prepares lighting and room dressing without starting physical movement.

## Activities

- **Night / room reset:** 65° Storage Mode and clear wall bays for charging,
  cleaning or after-hours use. The OCC lab uses this for its screening activity.
- **Working sessions:** pairs in shared work, teaching, library and creative
  settings with multiple ErgoFlex desks.
- **Project / showcase sessions:** groups of three where the floorplan permits.
  Single-desk lifestyle rooms use wall parking to make space for other uses.
- **Individual work:** return to the original authored work positions.
- Hospital observation, laboratory monitoring, security, police, mobile IT and
  mission-watch nights retain their operational workspaces.

Group arrangements use a 40-inch standing work height unless the owner has
saved a different Groove for that desk and activity. Storage uses 43 inches,
which permits the full 65° tilt on both desk widths.

## Movement and clearance

Desks lift before folding, with automatic shelving storage above 9°. Nearby
work chairs roll to available wall bays first. Desks then move sequentially,
with visible floor routes. Footprints include the CAD body, mounted monitors
and visible accessories. Every route and frame checks the swept footprint
against the measured room, fixed furniture and other desks. Parking leaves a
central opening on the cutaway/entry edge.

Pairs and triples search usable floor area. Temporary waiting bays allow desks
to exchange occupied positions. If no complete triple can reach its targets,
the routine uses pairs and explains the change. If a desk cannot reach its destination, it
stays in a clear bay and the status reports it; a routine never passes through
a bookcase, desk or chair. A changed route stops the routine. Stop, Escape,
manual controls, editing, scene changes and desk-size changes interrupt motion.

When even a pair cannot fit, the collaborative activity parks desks in Storage
Mode to open the room's existing meeting area and explains this in the controls.

## Keeping owner edits

No preset, finish, decal, accessory transform, saved Groove or recording is
replaced. `activityHome` stores only pose, height, tilt and light data for each
desk ID **and width**. The return data survives saving and reload. It is removed
only after a successful return. A fingerprint of the original fixed furnishings
allows an authored work posture to be restored where conservative 2D bounds
overlap a low fixture; newly changed furniture still receives clearance checks.
Individual saved activity Grooves take
priority over generated targets.

Temporary chair transforms compose with `dailyDelta`, so project export keeps
the owner's base furnishing layout. Returning desks also routes parked chairs
back when their original positions are clear. A scene/activity change restores
the normal daily chair dressing.

The routine illustrates parking for charging; it does not connect to hardware
or simulate electrical charging status.

## Verification

`node tests/room-desk-activities-test.mjs` checks both widths, storage,
pairs/triples, complete swept routes, exact return positions, night-watch
exclusions and width-specific return persistence.

`node tests/room-desk-activities-test.cjs` exercises loaded room rigs, automatic
stowing, movement, return and preservation of the existing desk builds.
`ACTIVITY_SCENES` can limit the browser check to a comma-separated list.

`node tests/room-desk-activity-return-test.cjs` saves and reloads Storage Mode
at both desk widths, then compares the returned poses and all build edits.
