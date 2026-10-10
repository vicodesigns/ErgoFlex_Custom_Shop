# Independent desks and scene Grooves — 10 October 2026

## Using the editor

Open **Desks** below the environment controls. Click a desk in the room, or choose it in **Control desk**. The floating movement controller now drives that desk's height, tilt, glide and rotation. Its label identifies the selected desk.

Enable **Rearrange items** to drag any ErgoFlex desk across the floor. Use the 15° rotation buttons or the controller's outer glide ring to turn it. With rearranging off, dragging the canvas orbits the camera; a click still selects a desk.

The panel can change the selected desk between 48″ and 60″, add a desk in clear floor space, or delete a desk. Main and supporting desks can both be deleted. Add, delete, resize, rotate, drag and saved settings support the existing Undo/Redo controls and shortcuts.

Choose an environment, room size/stage and time of day. Set the selected desk's position, height, tilt and lights, then choose **Save desk setting**, or **Save all desks** to save the ensemble. Positions and recipes are independent for each desk and daypart in that room layout.

Under **Desk Grooves**, choose **Record Groove**, drive the selected desk, and choose **Save recording**. Recordings last up to three minutes. **Play desk Groove** runs the selected recording or moves to its saved setting. **Play group Grooves** starts all desks with saved settings for the current daypart together. Approaches are planned around furnishings and other desks. Contact stops playback and raises the existing CLEAR alert; blocked routes require moving obstructions first. Group starts are synchronized, while each desk's approach and recording can have a different duration.

Current desk edits auto-save in this browser. **Save desk setting** deliberately creates a daypart destination; auto-save alone does not create one. Downloading a project includes desk identities, removals, sizes, finishes, positions, recipes and recordings. Audio permission and uploaded audio files are not embedded in a recipe; reconnect those sources when prompted.

## Implementation

- `scene-desk-data.mjs`: bounded version 1 data and recording interpolation. Local positions are millimetres; yaw is radians. Full recorded turns are preserved. Limit: 24 desks per room, 1,801 frames / 180 seconds per recording.
- `scene-desks.mjs`: desk selection, persistent identity, edits, recording and group playback.
- `scene-desk-rig.mjs`: batched bodies retain CAD lift and tilt cohorts. A fixed neutral anchor is shared across rebuilds. The full live CAD rig follows the selected desk; other desks retain independent kinematic bodies and role dressing.
- `scene-desk-routing.mjs`: room-local footprints, free placements, route planning and collision checks.
- `scene-desk-ui.mjs`: collapsible desk and Groove tools, using Store/Studio theme tokens.
- `studio.js`: adapters for CAD, movement, light recipes, project import/export, undo and safety alerts.

Storage is `ergoflex.sceneDesksV1`, keyed by `scene/layout`, then desk identity, with daypart settings inside each desk. Previous single-desk Groove saves remain compatible with the original time-of-day Groove controls.

The selected desk has the full LED pixel, music/game and reflected-light preview. Inactive desks preserve their recipes and preview basic strip color/effects; their batched bodies do not duplicate the selected desk's advanced pixel shaders or reflected-light projections. Group desk motion is a browser visualization, not a command to connected hardware.

## Ceilings

Lighting and suspended decorations now share a cutaway based on the camera's position in the room's coordinate system and its actual ceiling height. Moving/scaling the room root no longer changes that plane. Fixtures remain visible from inside and disappear above the ceiling, including classroom decorations.

A geometry audit checked fixture bounds in all 27 environments. None extended beyond the room shell. The user's specific misplaced ceiling remains unidentified pending the scene or screenshot; the cutaway correction is verified separately from that report.

## Verification

- `tests/scene-desk-data-test.mjs`: schema, independent recipes, recording interpolation, full turns and invalid inputs.
- `tests/scene-desks-test.cjs`: independent selection/posture/size, recordings, settings, project import, group playback, collision CLEAR, add/delete, undo/redo and rebuild.
- `tests/room-groove-save-test.cjs`: existing single-desk save/load/playback and reset compatibility.
- `tests/room-ceilings-test.cjs`: all 27 room fixture bounds and interior/overhead cutaways with a translated room root.

Browser tests use isolated HTTP servers so live-server's file reloads cannot interrupt an in-progress test.
