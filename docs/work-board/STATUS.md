# Film work board

Snapshot written 2026-11-21 so work can be resumed if credits run out. A fresh session: read this, then `git log -15`, then the memory index (MEMORY.md).

## Rules from Vico
- Agents are Sonnet 5.5; Opus 5.5 only after asking him.
- Merge finished, tested branches as they arrive (push video/cinematic-intro-hq and staging/director-merge; confirm HEAD = origin = staging and localhost:3000 = 200).
- Epoch bumps and film renders need his go, except epoch 13 (all-metal look), which he approved.
- Engineering and renders run on the Windows PC (session 3dmodeling, 2 agents at a time); Director UI work on the ui session.

## Needs Vico
- Send to desk: type the code once on the Fold: The code is in chat. Open the Director on the Fold, change something, tap Send to desk, and enter it. After that it remembers. [Fold, 5 min]
- Foot light: white strips off, only the blue: Vico chose only the blue foot light, the three white floor strips (center/left/right) OFF from before 7.5 s through the start of the lift. Windows PC is applying it as data in the cut's awaken source (chapter 1 key only), then stills 8.0-10.5 s. Still open: hold the blue until the 10.4 s lift chase? [Windows PC, Awaken, Running]
- Next film: say go when the stills look right: Epoch 13 (all metal) moves nine room chapters, so the next 4K is close to a full render. Codex's new faces ride on the same bump. The new score needs only a re-finish. I queue it when you say go. [Render, Your call]
- Score: listen to the new 0-30 s clips and tell me which second: Found it: the build-up before 12 s ran at a slightly slower tempo than everything after, then jumped. It now stays on one tempo, and a soft swell lands when the lift tops out. Before and after clips are on your phone. If the clash is at about 18.6 s (tilt start and chord change), nothing was added there yet. [Windows PC, Audio only, Merged]

## Working now
- All-metal aluminium look, every room: The gym metal matches Rise value for value, so the look itself is changing: brighter, more metallic aluminium everywhere, dumbbell included. Epoch 13 approved. [Windows PC, Epoch 13, eng/desk-aluminium-look]
- Fold touch re-test, all four screen sizes: Titles lane and layout fixes are merged. The Windows PC re-runs the touch test in portrait and landscape; this should be the first run that reaches the title steps. [Windows PC, Fold]
- Keyboard tray build, phases 1 to 3: Slide, swivel and tilt like the reference tray, keyboard staying on it. Joint model, Blender split into real parts, data and importer. Each phase merges as it lands. [ui, Keyboard tray]

## Queued (in this order)
- 0. Chapter 2 (Rise): phone flush, charge-pad ring clipping: Maya's phone floats about an inch above the desk and the black ring around the charge pad shares the desktop's plane (clipping triangles in the opening close-up). Nudge the ring up, then lower the phone onto it; before/after stills. Rise data is director-film/rise.json accessories ergoflex-phone y 12.4. [Windows PC, Rise, Next]
- 1. Commons: redwoods in both window views: One large redwood in one window, a mid-sized and a small one in the other, naturally spaced, in the shots during the chapter. No other scenery. [Windows PC, Commons]
- 2. Storage: RC remote on the second shelf: The remote floats and does not lift with the desk. It goes on the second shelf of the top shelf unit and moves with it. [Windows PC, Storage]
- 3. Create: fill and mirror the trade shelves: Painter and drafting shelves get real tools. Each trade also gets a mirrored shelf on the other wing in the same connector slot, with a different arrangement and highlights. Fade in and out stays as is. [Windows PC, Create]
- 4. Music: a natural walk for the gamer: Same end spot, curved path, his heading turning gradually forward as the desk centres. No turning on the spot. [Windows PC, Music]
- 5. Media: better speakers on the side pedestals: Properly modelled speakers that sit flush on the left and right pedestals, in the room’s materials. [Windows PC, Media]

## Done
- Codex: faces for the whole cast: Smiles, blinks and brows for all twelve characters, performed in the rooms and in film time. Committed and pushed; moves every room's people, so it rides on epoch 13 and is in the next film. [Codex, Merged]
- Final 4K film delivered: 240.3 s, 4K, on the desk and on your phone. Includes the hero pass with end card, Commons phone, awareness sonar, Rise exit, Coast hands, Wellness order, Media and Oilers edits, and the new score. [Film]
- Fold layout fixes, rounds 1 and 2: Readable pickers, 44 px tap targets, bigger stage, Titles lane open on a phone, timeline fits its lanes, narrower label column. Merged. [Director, Merged]
- Fold phone mode, titles by touch, Send to desk: Inspector as drawer or bottom sheet, closable demo card, top-bar overflow, move, trim and add titles by touch. Sends are protected by a desk code. Merged; the Director server was restarted. [Director, Merged]
- Diagonal wheel moves: Add a Travel move and pick a diagonal in the Direction list, then the distance in inches, like any other wheel move. Also Approach a landing spot. Merged. [Director, Merged]
- Chapter 1 foot light: Brighter, bluer pool under the base from 7.5 to 9.5 s, only that light. In the cut; shows in the next film. [Awaken, Merged]
- Keyboard tray design spec: Joints (slide, swivel, tilt), Blender split, new data field with its own keys, Director tray mode, phases and risks. Merged as docs; now being built. [Keyboard tray, Merged]
- Movie editor for the media movie chapter: Cut, trim, reorder and add dissolves or dips between clips, with a source bin that holds the full 10-minute movie. Merged. [Director, Merged]
- Screen reflection controls (brightness, saturation, contrast, tint): For the game and movie chapters, in the Lighting tab. Merged. [Director, Merged]
- Sonar rings visible in the Director: Fixed the live view so they show. Your awareness look is in the cut and in the film. [Director, Merged]
- Hero chapter pro pass: Camera, desk and light re-keyed without the whip, the end card moved inside the chapter. Chapter is now 25.5 s. [Hero]
- Commons: phone on the charger: The wheelchair girl sets the phone on the pad, it charges and glows. Yara’s phone no longer leaves a ghost. [Commons]
- Rise: jitter, landing and exit-from-stretch fixes: Arm switch is smooth, the arms come back to the keyboard by the same path they left it. [Rise]
- Wellness: new sequence: Sit, stand, type, notice, stretch and squats, then back to sitting. [Wellness]
- Coast: student hand glitch at 1:52: Fixed where she stands up. [Coast]
- Thumb control and pose-key selection: Curl or stretch the thumb in pose mode. Click a pose-key diamond in the People tab to select it. [Director, Merged]
- Housekeeping: Older full films and finished worktrees deleted. Disk is fine for now. All work committed and pushed with notes. [Repo]

