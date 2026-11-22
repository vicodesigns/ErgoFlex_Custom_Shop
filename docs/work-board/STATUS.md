# Film work board

Snapshot written 2026-11-21 so work can be resumed if credits run out. A fresh session: read this, then `git log -15`, then the memory index (MEMORY.md).

## Rules from Vico
- Agents are Sonnet 5.5; Opus 5.5 only after asking him.
- Merge finished, tested branches as they arrive (push video/cinematic-intro-hq and staging/director-merge; confirm HEAD = origin = staging and localhost:3000 = 200).
- Epoch bumps and film renders need his go, except epoch 13 (all-metal look), which he approved.
- Engineering and renders run on the Windows PC (session 3dmodeling, 2 agents at a time); Director UI work on the ui session.

## Needs Vico
- Send to desk: type the code once on the Fold: The code is in chat. Open the Director on the Fold, change something, tap Send to desk, and enter it. After that it remembers. [Fold, 5 min]
- Next film: say go when the stills look right: Epoch 13 (all metal) moves nine room chapters, so the next 4K is close to a full render. The new score needs only a re-finish. I queue it when you say go. [Render, Your call]
- Keyboard tray: answer 7 questions from the design spec: The spec is written and merged (docs/keyboard-tray/SPEC.md). Key questions: which real tray is it and does it swing; tilt and swing ranges; does tuck mean sliding under or folding flat; fixed to the tilting top or the frame; what happens to the keyboard when it tucks (the plate sits only 20 mm under the track); which chapters first. Plan is about 12 working days in 8 phases. [Keyboard tray, Spec done]
- Look at the foot-light stills and the 0.9 s gap: Before and after sheets for 6 to 10 s are on the desk (foot-sheet-full.jpg). Tell me if the blue should hold until the chase starts at 10.4 s. [Awaken]
- Optional: diagonal jog buttons for live recording: Not built. Each jog moves one axis, so a diagonal jog is a separate small job. [Diagonal, Optional]
- Optional: delete the four older full films: About 4.7 GB on the desk. The desk disk is 94% full with 21 GB free. [Cleanup, Optional]

## Working now
- All-metal aluminium look, every room: The gym engineer found the gym metal matches Rise value for value, so the look itself is changing: brighter, more metallic aluminium everywhere, dumbbell included. Epoch 13 approved. [Windows PC, Epoch 13, eng/desk-aluminium-look]
- Fold layout re-test on all four screen sizes: The Fold fixes are merged. The Windows PC re-runs the touch test in portrait and landscape, with every step now actually running, and sends screenshots. [Windows PC, Fold]

## Queued (in this order)
- 1. Score: fix the 12-18 s transition: The build-up is good, then the next part lands off the beat. The agent measures where the layers disagree and fixes the join. You get before and after clips on your phone. [Windows PC, Audio only, Starts first]
- 2. Commons: redwoods in both window views: One large redwood in one window, a mid-sized and a small one in the other, naturally spaced, in the shots during the chapter. No other scenery. [Windows PC, Commons]
- 3. Create: fill and mirror the trade shelves: Painter and drafting shelves get real tools. Each trade also gets a mirrored shelf on the other wing in the same connector slot, with a different arrangement and highlights. Fade in and out stays as is. [Windows PC, Create]
- 4. Music: a natural walk for the gamer: Same end spot, curved path, his heading turning gradually forward as the desk centres. No turning on the spot. [Windows PC, Music]
- 5. Media: better speakers on the side pedestals: Properly modelled speakers that sit flush on the left and right pedestals, in the room’s materials. [Windows PC, Media]

## Done
- Final 4K film delivered: 240.3 s, 4K, on the desk and on your phone. Includes the hero pass with end card, Commons phone, awareness sonar, Rise exit, Coast hands, Wellness order, Media and Oilers edits, and the new score. [Film]
- Diagonal wheel moves: Four diagonals at 45°, plus Approach a landing spot (straight leg, one diagonal, then the turn). Tested in a real browser and merged. [Director, Merged]
- Fold phone mode, titles by touch, Send to desk: Inspector as drawer or bottom sheet, closable demo card, top-bar overflow, move, trim and add titles by touch. Sends are protected by a desk code. Merged; the Director server was restarted. [Director, Merged]
- Movie editor for the media movie chapter: Cut, trim, reorder and add dissolves or dips between clips, with a source bin that holds the full 10-minute movie. Merged. [Director, Merged]
- Screen reflection controls (brightness, saturation, contrast, tint): For the game and movie chapters, in the Lighting tab. Merged. [Director, Merged]
- Sonar rings visible in the Director: Fixed the live view so they show. Your awareness look is in the cut and in the film. [Director, Merged]
- Hero chapter pro pass: Camera, desk and light re-keyed without the whip, the end card moved inside the chapter. Chapter is now 25.5 s. [Hero]
- Commons: phone on the charger: The wheelchair girl sets the phone on the pad, it charges and glows. Yara’s phone no longer leaves a ghost. [Commons]
- Rise: jitter, landing and exit-from-stretch fixes: Arm switch is smooth, the arms come back to the keyboard by the same path they left it. [Rise]
- Wellness: new sequence: Sit, stand, type, notice, stretch and squats, then back to sitting. [Wellness]
- Coast: student hand glitch at 1:52: Fixed where she stands up. [Coast]
- Thumb control and pose-key selection: Curl or stretch the thumb in pose mode. Click a pose-key diamond in the People tab to select it. [Director, Merged]
- Chapter 1 foot light, merged and in the cut: Brighter, bluer pool under the base from 7.5 to 9.5 s, only that light and only awaken. It shows in the next film. One catch: the blue lift chase starts at 10.4 s, so the floor is plain grey for about 0.9 s in between. Say if you want the hold extended. [Awaken, Merged, Look at stills]
- Fold layout fixes: Readable cut and chapter pickers, 44 px tap targets, bigger stage in portrait, stage tools on their own rows, the timeline toolbar fits or scrolls. Merged. [Director, Merged]
- Keyboard tray design spec: 364 lines: joints (tuck, swing, tilt), Blender split, new data field with its own keys, Director tray mode, phases and risks. Merged as docs only. [Keyboard tray, Merged]
- Housekeeping: Duplicate films and finished worktrees deleted. All work committed and pushed with notes. [Repo]

