# Room Groove routines

Choose a time in any measured room. Furniture, activity props and light change
immediately; the main desk stays in its current physical pose. A dashed floor
route and destination outline appear. Tap the actual desk, or use **Start
Groove**, to level the desktop, lift for travel, drive and turn, and settle into
the destination's height and tilt. The daily tabletop kit and LED preset change
on arrival. The existing remote remains available for manual motion.

**Stop** on either control surface or Escape stops in place. Start again to
replan from that position. Manual input, an editing tool, changing scene/room
size/desktop size, or launching AR cancels playback. Editing and AR keep their
existing controls; Groove is a Studio room feature.

## Physical routing

`room-groove.mjs` plans in room-local millimetres. It uses an oriented rectangle
measured from visible CAD in the neutral authored pose, excluding shader-only
LED pools/reflections. A 45 mm furniture buffer and 20 mm room inset are used.
Initial desk placement leaves 70 mm at room boundaries, including with the
60-inch desktop in compact rooms. New room or desktop-size selections start in
the room's authored desk bay; a saved social phase does not spawn an already
turned desk in the furniture. Imported projects can preserve their desk pose.

Floor-standing native and procedural furnishings, including other office
desks, contribute conservative bounding rectangles. Floor slabs, rugs, ceiling
fixtures and tabletop clutter are excluded. Camera cutaways do not remove
physical furnishings from consideration. Straight routes are attempted first;
a position-and-heading A* search can navigate around obstacles. Every segment
checks the swept footprint during translation and rotation, including diagonal
shortcuts. Playback follows that same interpolation and rechecks clearance
before each segment. Wheels spin through the existing desk motion machinery.

Phase destinations depend on physical room dimensions, with scene-specific
targets for performance, training, workshop and collaborative study. Occupied
destinations can use a nearby reachable location. Compact rooms can use a
shorter adjustment near the desk. Blocked starts or disconnected layouts show
a reason and enable **Check route**; no teleport is used to escape a collision.
If daily staging puts a movable chair or table into the parked desk's area,
preparation looks for a nearby clear staging position inside the room. Linked
table contents move together; the user's base arrangement stays intact through
the reversible daily delta. Fixed fixtures and custom props keep their poses.
When no such space exists, the routine reports the blocked starting area.

This is conservative navigation in the authored 3D room, not mesh-level contact
physics or navigation through a scanned real room. Manual Glide retains its
existing bounds behavior. Furniture staging itself is not a travel animation.

## Modules and verification

`room-groove-runtime.mjs` owns preparation, markers, motion stages, cancellation
and the current route. Studio supplies the actual rig, physical footprint,
posture limits, LED controls and activity dressing. Marker geometry/materials
are disposed when replaced. No extra shadow maps or per-frame textures are used.

Run `npm run test:room-groove` for planner barriers, detours and rotations,
browser routes in all 15 scenes, shared rig playback, Stop/resume, scene
cancellation, 60-inch clearances across all five Bedroom/Office/Library sizes,
saved furniture base transforms, selected-object staging and canvas tapping.
Room-life and lighting
tests cover daily staging, persistence, owned materials and lighting stability.
The website upload builder includes both Groove modules. Local implementation
does not automatically publish the changed files.
