# Director Mode and client presentations

Open http://localhost:3000/experience/?director=1, or click **Director Mode** in the intro.

## Create a client cut

1. Click **Choose environments**. Use an audience shortcut or select individual settings.
2. For each setting choose its room size/layout and check the times/activities to include. Each checked activity becomes a chapter. The Libraries shortcut chooses Humboldt Commons.
3. Name the new cut, choose chapter length, and optionally include the opening and finale. Click **Generate client cut**. Previous work remains in the cut library.
4. Enter the client/audience and click **Save cut**.

The picker reads the actual environment catalogue: all 29 settings including Product, all available layouts, and layout-specific activities. It does not keep a separate hardcoded scene list.

## Refine a chapter

- Select its card in the bottom timeline. Drag cards or use their arrow buttons to reorder. Add, duplicate, or remove chapters. Undo/redo keeps up to 40 edits during the current session.
- Edit headline, supporting text, duration (2–90 seconds), transition blend (0–3 seconds), environment, layout, activity, desk preset and 48″/60″ width.
- Changing the environment/layout/build reloads the shot. **Load / reset shot** reloads it manually.
- Orbit, zoom, or pan the live scene, then **Capture start view** or **Capture end view**. Captured endpoints interpolate during playback. Reset camera restores cinematic framing. The preview-position slider samples the chapter.
- Enable custom desk poses to author start/end height, tilt, sideways/forward movement and rotation. Choose the endpoint and edit its numbers. Physical desk height/tilt limits and room collision checks still apply. Floor offsets are relative to the chapter’s initial desk position. Automatic movements can be restored.
- **Preview chapter** plays only the selected chapter; **Play client cut** closes the editor and plays the whole presentation. **Replay** restarts the whole cut.

## Save, back up, present

- Drafts autosave in this browser. **Save cut** creates or updates that cut’s saved copy. Duplicate cut creates a separate client version. The library holds up to 60 cuts and 60 recent drafts; each cut holds up to 80 chapters.
- **Export cut** downloads editable JSON. **Import cut** creates a separate copy, so importing cannot overwrite an existing cut.
- **Copy presentation link** embeds chapter settings in the URL fragment. Opening it plays the selected cut without the editor. The recipient must be able to reach the same app server: `localhost` links only work on the host computer. This does not publish or host the app.
- Cut settings reference the app’s environment assets and desk presets. The JSON/link does not bundle custom uploaded artwork or every browser’s saved desk build. Those resources must also exist on the destination installation.
- Export is an editable presentation definition, not an MP4 video render. Very large cuts must use JSON instead of a link.
- Saves are browser-local, not an account sync service. Export JSON for backups and transferring work between browsers. Storage failures are shown with an export fallback.

## Isolation and checks

The cinematic iframe uses in-memory copies of existing browser settings. Director cuts use only `ergoflex.clientCuts.v1`; previewing does not overwrite Product builds, room rearrangements or artwork. The copied Flutter app remains separate; no edits to its original source were needed.

Run:

```sh
node tests/cinematic-cuts-test.mjs
node tests/cinematic-test.mjs
node tests/cinematic-timing-test.mjs
node tools/experience/verify-reference.mjs
```

Browser verification covered generating the Humboldt layout with four activities, saving and restoring edits, camera capture, custom desk height, chapter preview, rearranging/undo, and opening a copied client presentation link. Other environments are selectable from the live catalogue; this pass did not individually play every possible environment/activity combination.

## Camera keyframe track

The lower timeline now includes a **Camera** track for the selected chapter. Existing start/end camera captures appear as diamonds. Automatic shots expose outlined start/end views (plus intermediate wheel-movement views), so those can also be selected and edited without recreating them.

- Click a diamond to jump to its camera view. The sidebar shows its name, exact time, field of view and the movement to the next keyframe.
- Click the rail or use Preview position to scrub. Orbit/pan/zoom the scene, then **+ Keyframe** (or **+ Add camera keyframe**) captures that view at the playhead. Capturing at an existing keyframe time updates that frame.
- **Update selected view** replaces the selected camera with the current live view while keeping its time.
- Drag diamonds to retime them, with 0.05-second snapping. Frames sort by time automatically. You can also enter an exact time. Frames cannot occupy the same time.
- Choose **Smooth move**, **Linear move**, or **Hold, then cut** for the segment departing the selected frame. The first and last views hold outside their authored time range.
- Duplicate a keyframe to insert a copy in an available gap. Delete a keyframe using the sidebar or Delete/Backspace while its diamond is focused. Removing the last frame restores the automatic camera.
- Arrow Left/Right nudges a focused frame by 0.1 seconds; Shift changes that to 1 second. Undo/redo includes camera edits.
- Up to 64 camera keyframes per chapter. Timing is stored as a fraction of the chapter duration, so shortening/lengthening a chapter scales its camera timing proportionally.
- Reset camera restores the automatic shot. Saving, JSON export/import and presentation links retain the complete camera track. Old start/end cut files remain supported.

Keyframe tests: `node tests/cinematic-camera-test.mjs`. Browser checks covered selecting automatic views, numeric retiming, pointer dragging, adding a view after orbiting, duplicating/deleting, FOV and view updates, saving and chapter playback.

## Chapter play / pause

Use **Play chapter** in the timeline toolbar (always visible while editing) or beside Load / reset shot. It becomes **Pause chapter** during playback. Pausing keeps the exact position; pressing Play resumes it. **Restart** starts the selected chapter again from its beginning. Chapter playback stops at that chapter's end without advancing to another chapter. Scrubbing or selecting a camera keyframe pauses playback and places the playhead there, ready to resume. Editing also pauses playback; Play applies the latest chapter settings and continues from the current position. The top header Play/Pause controls the selected chapter while Director Mode is open.

## Bake a completed chapter

**Bake chapter** in the timeline toolbar or chapter sidebar renders a 1920×1080, 30 fps video of the 3D scene. Every frame is sampled and encoded in advance, including camera keyframes and desk motion, so a slow rendering frame makes the bake take longer rather than skipping that output frame. The next playback can decode the resulting video with the live 3D render loop stopped. This reduces rendering work during playback; it does not raise the live scene's frame rate.

- Finish the chapter, click **Bake chapter**, and wait for **Baked · 1080p / 30 fps**. You can cancel from the same button. Cancellation keeps the editable chapter and any earlier matching bake.
- **Use baked playback when available** is on by default. It applies to chapter previews and whole-cut playback. Chapters without a matching bake use live 3D.
- Pausing a baked chapter or selecting/editing a camera view restores the live scene at that position. This may briefly reload the scene. Play can reuse the matching baked clip again.
- Chapter edits and changes to saved build/artwork/scene configuration invalidate the matching cache. Bake again after changing scene asset files or app rendering code. A matching old bake becomes available again if the edit is undone.
- Bakes are stored in a separate browser IndexedDB cache, independent of Product designs, room edits, and artwork. They survive reloads on the same origin/browser. Up to 30 clips / 256 MB are retained; older clips are evicted to keep the cache bounded. Storage failure falls back to a session-only clip.
- JSON cut files and presentation links contain editable settings, **not** cached video blobs. Another browser can bake its own copy. **Download 3D video** exports the baked scene footage as a seekable VP8 WebM. Captions, UI demonstrations and soundtrack stay live in the presentation and are not embedded in that download.
- Baked footage is fixed: reactive effects are recorded as a rendered animation rather than responding to new microphone, music or user input during playback. Turn baked playback off to use live effects.
- Baking requires browser support for WebCodecs VP8 encoding and a secure context such as localhost. If unavailable, the editor reports it and retains live playback. Clips over 100 MB must be shortened before baking.

The writer follows the [WebM container guidelines](https://www.webmproject.org/docs/container/) and uses timestamped frames through [WebCodecs](https://www.w3.org/TR/webcodecs/). It uses one existing WebGL renderer, warms its shaders, renders at fixed output dimensions, and restores the live viewport after completion, cancellation or failure. The original Flutter source and copied app resources are not modified.

Verification: `node tests/cinematic-bake-test.mjs`, plus the cinematic, camera, timing and cut tests. A generated WebM was decoded and sought with FFmpeg/ffprobe; browser checks cover a baked chapter, cached playback, local persistence, cancellation and live editing fallback.

## Choose the short or long version

At the top of Director Mode, **Start with a version** offers **30-second reel** and **85-second story**. Each opens a new editable copy of the corresponding built-in score; it does not overwrite the cut you were editing. Name/save the copies, then use **Saved client cuts** to switch between your edited versions. The duration shown beside the chapter timeline always reports the actual duration after your edits. The original story/reel button in the playback footer switches the built-in presentation, not the cut being edited.

## Chapter Desk Groove — movement clips

The Desk Groove uses timed movement **blocks**, independently of the camera keyframes.

1. Select a chapter. Click **+ Lift**, **+ Tilt** or **+ Wheels** in the sidebar or above the three lanes. You can also drag these buttons onto their matching lane.
2. Click the new colored block. The **Desk Groove · chapter movement** inspector edits that block's start time, duration, target/distance, direction, average speed and acceleration. Click **Apply movement** (or press Enter) to commit the parameters together.
3. Drag the whole block to change its start time. Drag its left or right edge to change its length. The inspector remains available for exact values.
4. Add more blocks. Lift, Tilt and Wheels may run simultaneously. Two blocks on the same lane cannot overlap. Blocks must fit completely inside the selected chapter.
5. Play the chapter to preview desk and camera together. Bake renders both into the same 1080p / 30 fps footage.

Timing is in seconds. Lengthening a chapter leaves existing block times unchanged. Shortening is rejected if it would cut off a movement. Average speed is calculated from distance/angle and duration: changing speed changes duration; changing duration updates speed. Constant speed and eased acceleration are available.

Wheel actions support rotation (left/right, including 360° and multiple turns), travel (forward/backward/strafe left/right), and holding the wheels. Lift targets cover 28–52.5 inches; tilt targets cover −5–65 degrees. The preview still applies physical lift/tilt clearance and room collision rules.

**Add chapter** starts with an empty, stationary movement timeline. **Duplicate chapter** preserves the current chapter's movements. Existing built-in story movements appear automatically as editable blocks when the chapter loads, splitting at direction reversals and stops. Chapter 1 has **Move forward · 0–4s** and **Move backward · 4–8s**, each independently editable. Each block keeps its original acceleration and any simultaneous heading change. Selecting a block exposes its timing, speed and end position; moving or resizing it preserves that movement's path. The earlier combined original wheel card also splits when opened, preserving end-position edits. The first edit retains these original movements in the chapter's custom timeline. **Use built-in animation** restores the original performance and its blocks, and **Clear movements** gives a stationary timeline. Both edits support Undo.

When adding a block, the editor uses an open gap on its lane. If the available gap is shorter than the usual three-second starting duration, the new block fits that shorter gap. A full Wheels lane requires shortening/moving a block or lengthening the chapter before adding another. Blocks can touch at their endpoints but cannot overlap; Lift and Tilt can run alongside Wheels.

Earlier custom start/end and pose-keyframe movements remain supported. They appear as corresponding movement blocks when edited, preserving the original timing and easing. Existing saved cuts are not rewritten just by opening the editor. Each chapter keeps its own movement clips, initial pose and camera track. Save, autosave, JSON export/import and client links include the movement data; baked video blobs remain browser-local.

Keyboard: focus a block, then Left/Right nudges its start by 0.1 second (Shift: 1 second); Delete/Backspace removes it. Undo restores it. **Duplicate movement** finds another open gap on the same lane.

Optional **Record a performance** records into an empty gap across all three lanes. Hold the −/+ controls to move, release to hold, and stop to keep editable movement clips. It stops before the next existing movement or at chapter end, retaining existing clips. The **Starting desk position** section sets the pose before the first block.

These are presentation clips; playback and recording do not send movement commands to a physical desk. The original Flutter Groove source remains unchanged.
