# Daily room arrangements

The existing time buttons now stage the room and daylight, then prepare a
Groove destination for the main desk. All 15 environments support five physical room sizes
and Morning, Afternoon, Evening, Night and their scene's social/activity mode.

`room-life.mjs` owns daily staging. Each environment has a distinct activity
story: meals in the kitchen, shared research in the library, recording and a
live set in music, project work in the workshop, recovery in the gym, and so on.
Original trays, notebooks, notes, cups, palettes, equipment and textiles change
with the activity. Larger shared spaces gain a second set of shared materials.
These are editable scene assets and use existing supporting furniture and its
measured contact height. Imported model textures are retained.

## Furniture and scale

Chairs turn or pull out; tables and portable equipment change position.
Compact layouts use smaller movements. Table contents receive exactly the
same rigid transform as their support, including the new daily activity kit.
Architecture, built-in equipment and secondary office desks keep their anchors.
Furniture is never resized by this feature. Every staged furniture footprint
is constrained to the existing physical floor bounds. Manual Glide uses the
full room bounds. Groove additionally checks furniture clearance before driving.

## Lighting

The room's existing atmosphere first assigns the lamp colours and powers.
The daily lighting pass then balances task and communal areas: late work keeps
the desk lit with quieter surrounding lamps; social modes emphasise communal
areas. It reuses existing PointLights and the single directional shadow map.
New materials participate in the physical surface-detail pass. No per-frame
texture generation, new shadow lights or external asset downloads are added.

## Studio persistence

Saved scene transforms represent a user's base arrangement. A reversible
matrix delta supplies the daily pose. Serialization removes that delta;
hydration reapplies the current delta. This also works with existing saved
base transforms and project imports. Repeated time changes do not accumulate
offsets. Custom props keep their user-authored poses. Removed assets are never
reattached by staging. Selected room objects return from the transform proxy
before changing time; room transform undo entries are cleared because those
world-space snapshots belong to the previous arrangement.

`WorkspaceRoom.ready` includes native prop binding and daily staging before
Studio hydration. A token check prevents a replaced room's pending load from
staging the newly selected room.

## Verification and upload

Run `npm run test:room-life` for all 375 scene/size/time combinations, physical
bounds, linked table transforms, repeated-cycle drift, Studio persistence,
project import, deletion and stable lighting. `test:room-lighting` covers the
existing shadow and texture checks. The website upload builder includes
`room-life.mjs` and the Groove modules; the HTML and module entry versions are
`groove-routines-20261002`.
Local changes are not automatically published to the website.
