# Room furnishing placement

## Controls

Each environment starts with a 48″ desktop in its most compact room layout and a 60″ desktop in its larger layouts. Choosing a different room or layout applies that starting size. The desktop buttons still allow either size; changing time of day keeps that choice. Saved builds, shared builds and restored projects retain their explicit desktop size.

In a room scene, drag a floor furnishing with a mouse or one finger. Its floor height stays unchanged. Click/tap a furnishing and use **Rotate left** or **Rotate right** to turn it 15 degrees around its footprint. **Done**, Escape, or clicking empty room space clears the selection. Empty space still supports normal camera orbit controls.

Wall artwork, acoustic panels and grouped shelves drag horizontally and vertically within their wall plane. They remain attached to the same wall and clamp at its edges and ceiling. Floor furnishings clamp to the usable room rectangle. Rotation rejects new furniture/desk overlaps; move the furnishing into clear space to turn it.

Manual placement includes heavy furniture, rugs and small objects. Desk Glide stops on first contact and shows a persistent alert. **CLEAR** releases the movement hold. After acknowledging a portable piece such as a chair, bench, plant or microphone stand, Glide can push it until the desk moves away; a later encounter alerts again. Cabinets, bookcases, tables, sofas and speaker stands remain fixed. Flat rugs are selectable but do not block or push the desk.

The **shield** in the movement panel turns pre-collision protection on/off. When on, driving or turning toward a furnishing stops at a conservative 150 mm (about 6 in) clearance. It shows an amber **Obstacle ahead** alert. CLEAR acknowledges it; driving toward the same obstacle stops again, while retreating is allowed. Shield off retains contact alerts. Contact uses a 3 mm geometry tolerance.

Contact temporarily overrides LED pixels with a slow red pulse; pre-collision uses amber. LEDs must be enabled, and reduced-motion preference uses steady colour. CLEAR restores the selected colour/effect/music/game stream. **Sound alerts** enables the shared movement audio setting and two short tones per event; defaults off and requires a user click. Muting it stops the cue. Alerts hold all desk movement, but camera navigation and furnishing placement remain available so the object can be moved away.

The 3D touchscreen uses live canvas artwork inspired by the supplied October 6 app screenshots. It displays current height, tilt, speed settings, shield, sound, LED power and the alert. Both desktop sizes share the texture. Morning/afternoon use light artwork; evening/night/party and LED studio use dark. Changing the floating movement panel theme remains independent of the physical screen's scene theme.

## Compact movement controller

The October 7 controller uses one 720 × 298 landscape layout, with an **Extras** tab above it for turning, demo, recenter, sound, theme and touchscreen tools. It scales to fit narrow screens, keeps minimizing and dragging, and ignores previous device-size preferences. Preset values stay visible. Tap LED to switch power; hold it to open the LED Command Center. The Groove button starts/stops the room’s current setting. Saved poses and custom form names remain intact.

## Groove routines

**Rearrange items** in the room toolbar enables or disables direct furniture dragging and rotation. It starts on and remembers the browser's choice across scenes and reloads. Turning it off ends any active drag, clears selection and restores camera navigation. Desk contact, shield protection and acknowledged portable-object pushing remain active.

Direct drags and rotations share the editor's undo history. **Ctrl/Cmd+Z** undoes one completed gesture; **Ctrl+Y** or **Ctrl/Cmd+Shift+Z** redoes it. Room toolbar buttons offer the same actions. A drag includes supported props and any furniture it pushes. Blocked rotations and clicks without a move create no history entry. History lasts for the session and room edits are cleared when changing scene or room size; saved placements remain. Text fields keep their normal editing shortcuts. Desk driving is not recorded as a decoration edit.

Placements auto-save locally after a short debounce (350 ms). The room toolbar reports **Saving…**, **Saved in this browser**, or a storage failure. Undo/redo saves the restored arrangement too. This storage belongs to the current browser and site, so a different device or browser does not inherit it.

Use **Save Groove position** beside Start Groove to record the current location, rotation, height, tilt and LED recipe for the selected daily setting. Saves are separate for each scene, room size and desktop size. **Reset Groove position** restores that setting’s original preset. Timing remains authored.

All 15 furnished scenes expose a Groove for each of their five daily settings, in every room size and with either desktop. **Start Groove** plans and starts the current setting directly; selecting another daily setting prepares that routine without moving the desk. The desk levels and raises for travel, follows a checked route, then adopts the setting's height, tilt, LEDs and tabletop kit. Stop, manual controls, furniture edits and scene changes cancel travel. Collision alerts also hold Groove until CLEAR.

Camera cutaway visibility is refreshed when a camera tween finishes between render frames, so an invisible wall cannot intercept a desk tap. A blocked push chain reports its final blocker to the safety card, even when that object is lower than the desk body.

Project placement checks compare the saved base arrangement independently of daily staging. Restoring a night project keeps the night setup while preserving the original microphone and MIDI edits.

## Implementation details

- `room-interactions.mjs`: pointer capture, floor/wall ray planes, object selection, parent-aware world transforms, floor rotation, support grouping, persistent object registration and Glide contact adapter.
- `room-collision.mjs`: swept axis-aligned bounding-box contacts, height filtering, push chains, fixed obstacles and room boundaries. It is a conservative contact preview, not a rigid-body physics engine.
- `room-safety.mjs`: continuous swept contact and pre-collision checks, latch, acknowledgement and turn checks. These are scene geometry events, not simulated firmware sensor readings. The guard's distance is a preview calibration.
- `touchscreen-display.mjs`: live light/dark canvas texture, shared by the standard and extended physical displays.
- `workspace-3d.mjs`: imported prop anchors and support attachments. Procedural furnishing groups gain scene asset identities before saved transforms are hydrated.
- `studio.js`: rotation toolbar, existing scene asset local storage, capture cancellation, scene switching and motion integration.
- Music Studio speakers move with their stands, the bench moves separately, and guitar/shelf contents move with their supports. RoomLife table dressing and nearby tabletop props follow their floor support.

Saved positions and orientations are scoped to the scene and room size using the existing scene asset store. Explicit changes invalidate a prepared Groove so its old path cannot drive through newly placed furniture. The editor's selection tools take priority over the direct room dragging controls.

## Verification

`npm run test:room-interactions` covers swept contacts, push chains, walls, height separation, actual Glide chair pushing/cabinet blocking, mouse dragging, rotation, wall attachment, scene switches, persistence, touch dragging, grouped table dressing and rendered LED floor response.

`npm run test:room-safety` covers contact latch/CLEAR, optional audio, LED priority/restoration, guard clearance, mobile CLEAR access, acknowledged chair pushing and both touchscreen theme/material bindings.

`node tests/compact-remote-test.cjs` checks fixed sizing, legacy size migration, Extras, collapse, theme, keyboard/STOP and narrow Fold layouts.
