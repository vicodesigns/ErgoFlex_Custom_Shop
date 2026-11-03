# Review A: chapters 1–6, picture-lock pass (independent)

Reviewer A, 2026-10-29. Footage: `renders/01–06.mkv` (1080p30, ungraded, no titles). All six durations match the locked timeline (34 / 16 / 18 / 14 / 11 / 11 s). I formed every verdict below from the frames and measurements before I read `NOTES.md`. The last section compares my findings with the DP's notes.

## Verdicts

| # | Chapter | Verdict | One-line reason |
|---|---------|---------|-----------------|
| 1 | awaken | **FIX** | The camera hitches at every spline sample, worst at 3.37 s. It swings out and back around the low hero (near-stop at 15.6 s, then the fastest whip of the chapter as title B lands). It locks off for 3 s under title B and ends on 7 s of idle push with a frozen tail. |
| 2 | rise | **FIX** (small) | The head handle is effectively frozen: 1.6 px/s, static until 1.7 s, so the ch1→2 dissolve is a still on a still. Also a bright pot and cabinet in the title zone, and a hot glare blob on the portrait monitor. |
| 3 | create | **FIX** | At 2.97 s every desktop prop vanishes in one frame, in the centre of the top shot (auto-stow at 9°). A second pop at 10.53 s. The empty desktop is clipped to pure white for 3–7 s. The 65° payoff doesn't read as a tilt. The tail is frozen. |
| 4 | commons | **PASS with notes** | Clean, moving handles, no geometry issues. The opening doesn't read as a "commons", and the red wheelchair competes with the desk at the end. |
| 5 | coast | **PASS with notes** | Smooth, well-paced dolly with live handles. It's higher than the brief's station height, and the hero desk's casters touch the frame bottom at the end. |
| 6 | oilers | **FIX** | The red bottle, orange notebook and white student-table corner sit in the lower-left title zone until about 8 s, not the ~4 s in the notes. The tabletop covers more than 20% of the frame for about 2.5 s. The tail is near-frozen. |

## Method

- **Contact sheets.** Every 0.5 s, 480 px tiles. The yellow box marks the lower-left third (x < 640, y > 720 at 1080p). Files: `evidence-a/sheet-NN-MM.jpg`.
- **Full-resolution stills.** Taken wherever something looked off. The yellow box is the title zone. Files: `evidence-a/chNN-full-T.jpg`.
- **Motion.** Per-frame Farnebäck optical flow (the median vector of textured pixels, scaled to px/frame at 1080p). Also the camera's world speed, computed from `camera.keys`. Plots: `evidence-a/motion-NN.png`. Upper panel: on-screen speed, with grey lines at the camera-key times. Lower panel: speed per key segment. Units are world units/s; the treatment says ≈ m, the DP's notes imply ≈ 0.67 m.
- **Freezes.** `freezedetect` at −60 / −45 / −35 dB and `mpdecimate` (strict). There are no exact duplicate frames in any chapter. Near-static stretches were measured with the flow.
- **Handles.** 8 frames from each end, every 3rd frame: `evidence-a/handles-NN.jpg`.
- **Consecutive-frame strips.** In the fastest or suspicious moves: `evidence-a/ch01-strip8-*.jpg`, `ch03-pop-*.jpg`, `ch04-strip-*.jpg`.

### Handle and motion summary (on-screen speed, px/s at 1080p)

| ch | head 0–0.75 s | tail last 0.75 s | peak on-screen speed | largest one-frame velocity step |
|----|------:|------:|------:|------|
| 1 | 27 | **2.8** (last 0.3 s: 1.9) | 16.7 px/f @ 3.40 s | **4.5→12.9 px/f @ 3.37 s** |
| 2 | **1.6** (first 0.3 s: 0.9) | **2.2** | 2.5 px/f | 1.2→2.0 @ 10.97 s |
| 3 | **3.9** (first 0.3 s: 1.5) | **1.1** (last 0.3 s: 0.4) | 2.3 px/f | object pop @ 2.97 s (see ch 3) |
| 4 | 15 | 22 | 4.4 px/f | 1.66→1.1 (background) @ 9.85 s |
| 5 | 22 | 29 | 5.0 px/f | ≤0.6 px/f (fine) |
| 6 | 11 | **4.7** (last 0.3 s: 1.8) | 1.5 px/f | ≤0.2 px/f (fine) |

Anything under ~5 px/s reads as a locked frame. The treatment says the camera keeps moving through the handles.

## Systemic issues (fix once, re-render 1, 2, 3, 6)

### S1. The heads and tails come to rest

None of the six `cameraPlan`s sets `easeIn`/`easeOut`. The header of `camera-spline.mjs` says both default to true ("starts from rest" / "ends at rest") and tells you to *"set both false for chapters that dissolve in and out."* The result is the frozen handles in the table above. The ch1→2 dissolve (32.5–34 s of the film) crossfades two near-still frames, and so does the end of ch3.

**Fix.** Set `"easeIn": false, "easeOut": false` in chapters 2–6, and `"easeOut": false` in ch 1. Opening from black, ch 1 can keep `easeIn`. Re-run the spline tool and re-render. Make sure the last story key still has somewhere to go: with ease off, the end velocity is extrapolated from the last segment, so a last segment that barely moves still ends nearly still. Give the final segment at least ~0.15 u/s (ch 2, 3 and 6 are at 0.01–0.04 u/s in their last key segment).

### S2. Linear sampling turns the spline into a polyline, visibly so in ch 1

The tool caps output at 64 linear keys spread evenly in time, and the stage interpolates linearly between them. So the velocity is constant inside each segment and jumps at every key. In 11–18 s chapters the segments are about 0.27 s long and the jumps are small (ch 5 ≤ 0.6 px/f). Ch 1 is 34 s, so the segments are 0.54 s long, and its fast, accelerating pull-out shows the jumps: `motion-01.png` is a staircase.

| time (s) | on-screen speed (px/frame, 1080p) |
|----------|------------------|
| 1.67 | 9.2 → 5.6 |
| 2.23 | 5.8 → 2.1 |
| 2.79 | 2.2 → 5.6, and the direction turns 90° (sideways track becomes a crane-up) |
| **3.34** | **4.5 → 12.9 → 16.7 in two frames** |
| 5.57 | 8.5 → 5.6 |
| 6.13 | 4 → 1 |
| 7.25 | camera speed 1.48 → 0.56 u/s |
| 18.95 | camera speed **1.51 → 0.29 u/s in one frame**; the portrait landing "hits a wall" |
| 26.75 | 0.87 → 0.42 u/s |

See `evidence-a/ch01-strip8-3.23-3.47.jpg`: the leg barely moves over 3.23–3.33 s, then travels about 10–15 px per frame from 3.37 s. All of 1.67–6.13 s falls inside title beat A.

**Fix.**
- **Best:** raise the 64-key cap, if the stage accepts more keys. That's a tool or stage change, outside the DP's remit, so I'm raising it to the orchestrator. Alternatively, add a smooth (Hermite) interpolation mode in the stage.
- **Within the DP's control:** make the ch 1 speed curve gentle enough that 0.54 s steps don't show.
  - Spread the aim tilt-up that starts abruptly at 3.3 s over about 2 s: change the 2.7 s key's target y from 0.164 to ≈0.26 and the 4.0 s key's from 0.569 to ≈0.45, so the aim rises steadily from about 2.2 s.
  - Keep the 4.0→6.9 s pull-out near constant speed instead of peaking at 2.1 u/s and braking to 0.56 u/s at 7.8 s.
  - Never let consecutive segment speeds differ by more than about 25%.

## Chapter 1: awaken (34 s) — FIX

The macro opening (0–4 s) is genuinely premium. The omni-wheel rollers, the brushed leg panel and the cyan underglow look great (`ch01-full-1.0.jpg`, `ch01-full-2.5.jpg`, `ch01-full-4.6.jpg`). The pull-out to the silhouette lands the title A frame well (`ch01-full-7.0.jpg`). The problems are all in how the camera moves and in idle time.

### 1a. The camera swings out and back around the low hero (11.6 → 15.2 → 19 s)

This is the most important fix. Measured as an angle around the desk: the orbit runs +8° (9 s) → −34° (11.6 s) → **−82° (15.2 s, low hero)** → back to −18° (19 s, portrait). The camera nearly stops at 15.6 s (0.26 u/s), reverses, and whips back at **3.2 u/s and 27°/s** over 16.2–18.4 s. That is the fastest move in the chapter, and it lands exactly when title B arrives at ~16 s.

On screen the desk rotates one way, stops and spins back (`evidence-a/ch01-pendulum-13-19.jpg`: 13.0 front, 14–16 right side, 17 front again, 18 left 3/4). To a viewer this reads as indecision, and it puts the hardest motion under a title.

**Fix.** Keep the low hero's azimuth and *crane up* into the portrait instead of swinging back:
- 19.0 s key ≈ position (2.3, 2.0, −6.9), target (0.9, 1.5, −0.1), FOV 26: the same azimuth as the low hero, raised about 1.6 u. That makes 15.2→19 s a 0.4 u/s rise, which is motivated (the hero rises).
- 22.6 s key: about 0.8 u further along toward the coming arc, e.g. (2.9, 1.95, −6.7).
- Let the only change of direction happen inside the title-B drift, where speed is lowest. Then arc with the desk's turn-left (23.35–25.8 s) to the 26.8 s full-lift key. That arc is motivated by following the desk.

At 15.5 s the desk shows its front and monitor from this azimuth, so the portrait still reads as a 3/4 (`ch01-full-15.5.jpg`). The desk sits right of centre, so the title zone stays clear. If that azimuth is rejected, the fallback is to shorten the excursion (low hero at no more than −45°) so the reversal is under 30° and the return is under 1.5 u/s.

### 1b. Title B locks off for 3 s (19.0–22.3 s)

On-screen motion is 6–8 px/s, and `freezedetect` at −45 dB flags 19.23–22.23 s (`motion-01.png`). That's twice the 1.5 s maximum. The landing into it is the one-frame 1.51→0.29 u/s brake at 18.95 s.

**Fix.** Make 19→22.6 s a visible drift of at least 0.3 u/s or about 3°/s: move the 22.6 s key about 0.8–1.0 u along the arc instead of the current 0.87 u that is mostly cancelled by the target moving with it. Ease into it over at least 1 s.

### 1c. Dead tail (26.6–34 s)

All desk action ends at 26.55 s. What follows is 7.4 s of a 1.6°/s push from 7.96 to 7.03 u: the desk grows about 12%, at about 10 px/s. The last 0.75 s is effectively frozen (2.8 px/s). The angle is low, so the white desktop is invisible and the desk reads as a dark frame with red edges (`ch01-full-30.0.jpg`). The brief asks to compress idle gaps, and this is the longest one in chapters 1–6.

**Fix (pick one or both):**
- (a) Retime the full lift 2 s later (lift 23→25 s, turn 23.35→25.35 s, tilt-downs 25.1/26.3→27.1/28.3 s), so the action ends at about 28.5 s. This also gives title B its full 16–23 s window clear of the lift.
- (b) Make the push read: go from distance 7.96 to ≈5.5 u, and FOV 28→26, over 27–34 s (about 0.35–0.45 u/s). Set `easeOut: false` so the dissolve into ch 2 is moving. Crane the end up to about y 1.3 so the lit desktop edge starts to show on the way out.

### Notes (not blocking on their own)

- **0.5–1.5 s:** the bright cyan pulse ring sweeps through the lower-left title zone (the lower-left's standard deviation reaches 30, against about 10 afterwards; `ch01-full-1.0.jpg`). It leaves right as title A arrives (~1.5 s). Mostly covered by the fade from black, but tilt the 0 s and 1.4 s aims up about 2° so the near arc stays below the frame, or start title A at ≥1.8 s.
- **3.4–5.6 s:** the floor grid streams through the lower-left at 10–17 px/frame behind title A. It's low contrast, so acceptable, but fixing S2 will calm it.
- **6.0–7.5 s, silhouette:** the casters nearly touch the frame bottom (y ≈ 1045 of 1080 at 7.0 s) with about 200 px of empty space above the uprights. Lower the 6.9 s key's target y from 1.498 to about 1.38, or widen the FOV from 26 to 27.5, to get about 70–80 px under the casters.
- **Throughout, scene issue for the app:** the monitor renders as a pure-black, reflection-free slab. On a near-black void it reads as a hole. A faint reflection or a dim screen would lift every void shot (ch 1, 8, 12).
- **Final move:** a slow push-in, with the image drifting screen-left at about 0.3 px/frame and a slight crane up. Ch 2 opens with a slow push-in, which is compatible, but both ends are currently frozen (S1).

## Chapter 2: rise (16 s) — FIX (small, mostly S1)

The pedestal-with-the-lift idea works. The desk stays pinned in frame (desktop at y ≈ 720 of 1080 from 0 to 7.5 s) while the room drops away. No clipping, voids or black edges.

### 2a. Frozen head (0–1.7 s)

On-screen speed is 1.6 px/s in the handle and about 2–3 px/s until the lift starts at 1.6 s. The camera moves 0.01–0.06 u/s (`motion-02.png`, `handles-02.jpg`).

**Fix.** S1 (`easeIn: false`), and give the 0→1.6 s segment real travel: start the 0 s key about 0.25 u further back along the push direction, at about (3.3, 1.5, 1.85).

### Notes

- **Title zone, 0–7 s:** the ficus trunk and its large pale-blue pot, plus the pale cabinet, fill the lower-left third. Its mean luma is 141 of 255 (`ch02-full-2.0.jpg`), so a white title will have poor contrast. The DP describes this as "low-contrast foliage"; the luma is mid-high, not low. Either plan a grade or scrim for the title, or truck the opening about 0.2 u to screen-right (+z) so the pot leaves the frame-left edge.
- **9.5–16 s:** a hot specular blob sits on the portrait monitor (around x 790, y 200 at 14.5 s; `ch02-full-14.5.jpg`). It looks like a lens-flare sticker. Shift the low-3/4 keys about 0.1 u laterally until the reflection leaves the bezel, or accept it and fix it in the grade.
- **10.4–12.9 s:** the crane-down to the low 3/4 accelerates in visible steps (1.2→2.0 px/frame at 10.97 s) and brakes from about 1.45 to 0.1 px/frame over 12.6–12.9 s. Lengthen the 10.6→13.2 s move by about 0.6 s, taken from the 13.2→16 s drift, so it lands softer.
- **Foreground:** the chair back on screen-right (≤ ~12%) is sharp, not "soft". The renderer has no depth of field, so this is acceptable.
- **Final move:** a slow push-in, drifting slightly. Ch 3 opens on a near-static high top shot. The scale contrast is good, but both sides are frozen until S1 is fixed.

## Chapter 3: create (18 s) — FIX

### 3a. Props pop out at 2.967 s (frame 89)

The tablet and pen, sketchbook, mouse, clipboard and keyboard disappear in a single frame (`evidence-a/ch03-pop-2.93-vs-2.97.jpg`). The frame's mean luma jumps from 151.6 to 160.2. It happens in the centre of the top shot, inside the first 7 s, while the viewer is studying the desktop. Cause: `desk-auto-stow.mjs` `STOW_ANGLE = 9`, and the 0→25° tilt crosses 9° at 2.97 s. It's the cheapest-looking moment in chapters 1–6.

**Fix.** Start the chapter already stowed and in drafting mode: set `motion.initial.tilt` to about 12°, and have the "Drafting · 25°" clip go 12→25° (1.4–4.4 s). That also matches the brief ("top shot of the drafting surface at 25°"). Or start the first tilt clip at 0 s with a duration that crosses 9° by about 0.4 s, so the pop happens inside the head dissolve. That is weaker, because the frame is still half visible.

### 3b. Second pop at 10.533 s

The green and black mugs on the stow shelf behind the monitors vanish in one frame as the tilt crosses the 50° easel angle (`evidence-a/ch03-pop-10.50-vs-10.53.jpg`, upper centre). It's smaller, but still a visible pop.

**Fix.** Raise the 10.6 s key's target about 0.1 u (or drop the camera about 0.15 u) so the shelf sits behind the monitor bezel for 10.3–10.8 s. Better, report it to the app: stowed items shouldn't vanish at the easel transition.

### 3c. Clipped desktop, 3–7 s

Once the props are gone, the whole desktop is ≥245 luma: a featureless white slab in the centre of frame (`evidence-a/ch03-clip-masks.jpg`, left; 9–13% of all pixels clipped). The 25° tilt can't be read on a surface with no texture.

**Fix.** Grade it down, or ask for −0.5 to −0.7 EV on the studio key for this shot. With 3a fixed, the stowed accessories no longer break the surface up, so this matters more.

### 3d. The 65° payoff doesn't read as a tilt (10.6–18 s)

The "side profile" and "easel portrait" look at the tilted surface nearly face-on. It shows as a big, close, blank white panel with hand cut-outs, cropped by the frame bottom and right, covering about 30–35% of the frame (`ch03-full-9.0.jpg`, `ch03-full-14.0.jpg`). Nothing in the frame says "65°", and there is no canvas or art on the board. A glossy black keyboard shape is cut off at the bottom edge (around x 830–1010 at 9.0 s, x 1100–1250 at 14 s). The window, sculpture and paintings in the background are lovely.

**Fix.**
- Swing the 10.6 / 14 / 18 s keys about 25–30° further around toward the desk's end, so the camera looks along the tilt hinge.
- Drop them from about 2.1–2.2 to about 1.5 u, so the 65° board silhouettes against the window wall.
- Back off until the base shows. If the cabinet stops you (DP note), trade FOV: 46→52 at the easel portrait is still inside the interior range plus the hero allowance.
- If there's an artist canvas preset for the easel angle, enable it for this chapter. "Paint at 65°" on a blank board undersells it.

### 3e. Frozen tail

1.1 px/s over the last 0.75 s, 0.4 px/s over the last 0.3 s, and `freezedetect` (−45 dB) from 17.33 s. **Fix:** S1.

### Notes

- **Title zone, 0–2.5 s:** the plaster-head pedestal (red cloth, white cube) and the corrugated grey curtain sit in the lower-left third (`ch03-full-0.5.jpg`). From 2.5 to 7 s it's bright wood floor with a mean luma of 183, which needs a scrim for a white title. Fixing 3a (props gone at the start) is a good moment to trim the opening aim about 3° to screen-right as well.
- **Final move:** a slow push, drifting screen-left, coming to rest. Ch 4 opens sliding right at table height, which is compatible once S1 keeps it moving.

## Chapter 4: commons (14 s) — PASS with notes

The handles move (15 / 22 px/s), the speed profile is smooth (`motion-04.png`), and there's no clipping or black edges. The desk visibly drives about 3 m along the tackboard and docks at the project table, so the story "roll into the conversation" reads by the end (`ch04-full-13.0.jpg`). The 9.73–9.83 s dip in measured flow is foreground parallax, not a hitch: the background region moves continuously at 2.2→1.0 px/frame (`ch04-strip-9.63-9.87.jpg`).

- **0–5 s doesn't read as a commons.** It's a blank lit wall, a dark glass doorway over the left 30%, a lone chair and a tackboard (`ch04-full-1.0.jpg`). Tables and chairs only arrive at about 6.5 s. Fine as an intimate opening, but the brief's "sliding past chairs" happens late. Pull the first table and chair-back parallax forward to 2–4 s by starting about 0.6 u closer to the study tables.
- **Title zone, 0–7 s:** the dark task chair's chrome base (0–2.5 s), then the bright beige floor-seam diagonal (3–7 s), in the lower-left third. The lower-left's standard deviation is 40, the second-highest in chapters 1–6. Acceptable with a scrim. Better: tilt the aim up about 2° so the seam drops out of the lower-left corner.
- **8.4–10 s:** the camera runs at about 1.8–1.9 u/s and the desk at about 0.35 m/s, so the camera passes the desk rather than "tracking alongside". It reads as overtaking. Fine if intended (the notes say so), but trimming the 8.46 s and 10.6 s segments by about 25% would keep the desk in the right two-thirds longer.
- **Ending, subject hierarchy:** the saturated red power wheelchair, lower-right at about 12% of the frame, is the most eye-catching object, and the Humboldt desk is only about 25% of the frame width in mid-ground. Push in about 0.5 u more over 12–14 s, or arc about 8° screen-left, so the desk sits on the left-third line and the wheelchair is cropped to its seat-back.
- **Final move:** a gentle push-in, with the image drifting screen-right. Ch 5 opens on a lateral slide. Fine.

## Chapter 5: coast (11 s) — PASS with notes

This is the best-behaved chapter for motion: smooth speed (steps ≤ 0.6 px/frame), live handles (22 / 29 px/s), no clipping or occluders over 20% for more than 0.5 s, and the station row reads clearly (`sheet-05-01.jpg`).

- **Height:** the frame reads as a standing high angle looking down onto the desktops (camera y 2.45→2.15 u, which the DP puts at about 1.5–1.6 m), not the brief's ~1.3 m station-height slide (`ch05-full-1.0.jpg`). If the ceiling allows, drop all keys about 0.25 u and raise the targets about 0.1 u. Station-height parallax on the uprights would be far more premium. The DP keeps the pitch down to hide the open ceiling, which is a fair constraint, so I'm leaving this as a note.
- **No green screen:** the DP says it's behind the camera. Accepted as a documented deviation; the big display is passed instead.
- **Title zone, 0–2.5 s:** the black task chair and its chrome star base sit in the lower-left third (`ch05-full-1.0.jpg`). They're dark, but high-contrast against the grey carpet. Starting about 0.3 u further along +z would put the chair at frame centre-left instead.
- **Ending:** the hero station's casters touch the frame bottom (y ≈ 1070 at 10.5 s; `ch05-full-10.5.jpg`). Lower the 11 s target y by about 0.08 u for about 50 px of floor under the wheels.
- **Exposure:** the overall image is murky navy (mean luma 73). For the grade, not for the camera.
- **Final move:** the camera trucks along +z and the image slides screen-right, decelerating into a slight push. Ch 6 opens with a pedestal up. Different axes, but the dissolve is soft enough.

## Chapter 6: oilers (11 s) — FIX

The rise-and-reveal itself is good. The 0.5 s frame under the table edge is a strong opening image (`ch06-full-0.5.jpg`), the classroom reveal reads well, and the push to the station lands cleanly (`ch06-full-10.5.jpg`).

### 6a. Dirty title zone until about 8 s

The white student-table corner, the **saturated red bottle** and the orange notebook stay in the lower-left third from about 1 s until about 8 s, not "~4 s" as the notes say. At 5.0 s the bottle stands at about x 450–510, y 810–1010: exactly where the title sits (`ch06-full-5.0.jpg`; also 6.5, 7.0 and 7.5 s on `sheet-06-01.jpg`). The lower-left's standard deviation over 0–7 s is 86, by far the highest in chapters 1–6.

**Fix.** Move the push earlier and further: bring the 7.0 s key forward to about 5.0 s and add about 0.5 u of forward travel toward the station, so the table and bottle pass under the frame bottom by about 4.5 s. Keep the 11 s landing. If the props can be moved in the shot, the cleaner fix is to move the bottle and notebook to the far side of the table.

### 6b. Foreground over 20% for about 2.5 s

From 0.7 to 3.2 s the white tabletop covers about 30–38% of the frame (1.0, 1.5, 2.0 and 2.5 s on `sheet-06-01.jpg`). The occluder is motivated (the brief asks for a rise from behind a student desk), but it breaks the hard rule (nothing over 20% for more than 0.5 s). Make the rise steeper and earlier: reach y 2.2 by about 2.2 s instead of 3.4 s. The tabletop then drops below 20% by about 2 s.

### 6c. Near-frozen tail

4.7 px/s over the last 0.75 s, 1.8 px/s over the last 0.3 s. **Fix:** S1.

### Notes

- **0–7.5 s:** the upright of a neighbouring ErgoFlex desk is a sharp dark strip with screw heads on the left edge (x 0–110). It reads as something right against the lens. Confirm it's at least 0.3 m away. Trucking about 0.1 u to screen-right removes it.
- **Ending:** the casters are cropped at the frame bottom, and the grey designer chair takes the lower-right (about 8%). Acceptable.
- **Final move:** a push-in, drifting screen-left.

## FIX list (priority order)

1. **Ch 1, 11.6–19 s.** Replace the swing out and back around the low hero (−34° → −82° → −18°, with a 3.2 u/s whip at 16.2–18.4 s under title B) with a crane up at the low hero's azimuth. The 19 s key goes to ≈ (2.3, 2.0, −6.9), and the only change of direction moves into the title-B drift.
2. **Ch 3, 2.967 s.** All desktop props pop out in one frame (stow at 9°). Set `motion.initial.tilt` ≈ 12° and tilt 12→25°. Also hide or report the 10.533 s mug pop.
3. **Chapters 1–3 and 6: handles.** Set `easeIn: false` / `easeOut: false` (ch 1: `easeOut` only) and give the end segments ≥ 0.15 u/s. The current heads and tails run at 0.4–4.7 px/s, which looks frozen.
4. **Ch 1, 1.67–7.25 s and 18.95 s: velocity steps.** Raise the spline tool's 64-key cap (orchestrator, tool or stage decision), and smooth the ch 1 speed curve so adjacent segments differ by ≤ 25% (spread the 3.3 s tilt-up over about 2 s; soften the 18.95 s landing).
5. **Ch 6, 1–8 s.** Get the red bottle, notebook and table corner out of the title zone by about 4.5 s: bring the 7 s key forward to about 5 s with +0.5 u of push. Shorten the more-than-20% tabletop coverage (reach y 2.2 by about 2.2 s).
6. **Ch 1, 26.6–34 s: dead tail.** Retime the full lift 2 s later and/or push from 7.96 to about 5.5 u (FOV 28→26) with `easeOut` off.
7. **Ch 1, 19–22.3 s.** Title B lock-off (~7 px/s for 3 s). Turn it into a visible drift of about 0.3 u/s, eased in over 1 s.
8. **Ch 3, 10.6–18 s.** Make the 65° readable: swing about 25–30° toward the desk's end and drop to about 1.5 u. Grade the 3–7 s clipped desktop down 0.5–0.7 EV.
9. **Ch 2, 0–1.7 s.** Frozen head: covered by item 3, plus start the 0 s key about 0.25 u further back.

## Where I differ from the DP's notes (read after forming the verdicts above)

- **Ch 1:** the notes describe "one continuous spline" and "slow drift" for title B. The data shows a staircase velocity (S2), a reversing orbit with a 3.2 u/s whip at the title-B entrance, and a 3 s near-lock. The notes don't mention any of these.
- **Ch 3:** the notes don't mention the 2.97 s and 10.53 s stow pops or the clipped desktop.
- **Ch 6:** the notes say the tabletop "sweeps out of frame by ~3 s" and the busy lower-left lasts "the first ~4 s". In the render, the bottle and notebook are in the title zone until about 8 s (`sheet-06-01.jpg` at 5.0–7.5 s).
- **Ch 2:** the notes call the ficus "low-contrast foliage and pot". The lower-left's mean luma is 141; contrast with a white title is the problem, not busy-ness.
- **Handles:** the notes don't mention ease-in or ease-out. The spline tool's own header says dissolve chapters should disable both.
- **Agree:** the ch 4 overtake is intentional, the ch 5 green-screen omission is justified, and the ch 2 and ch 3 room-size compromises are real constraints.

---

# Revision 1 (re-review, 2026-10-29 ~23:40)

Re-review of the revised renders. Ch 1 is the 23:35 render with the 9.4–11.9 s wheel pause. Ch 2–6 were rendered 23:00–23:22, and ch 7 is the 22:41 render, used only for the 6→7 dissolve. All durations still match the locked timeline.

I re-ran every measurement from the first pass:
- per-frame optical flow;
- camera-key speeds (now 163–508 keys per chapter);
- handle speeds;
- one-frame velocity steps and peak acceleration;
- a block-wise local frame-difference scan for one-frame pops;
- statistics for your title box (x 96–1060, y 760–990) at 1.6–7.5 s, plus 16–22.5 s for ch 1;
- 1.5 s cross-dissolve simulations from 1→2 through 6→7.

I also burned the real `final/titles.ass` (with its scrim) onto each chapter using the app's Poppins fonts (`r1/titled-NN.jpg`), so title clashes are judged against the actual type, not just the box.

All evidence for this pass is in `evidence-a/r1/`. The lower panel of `motion-NN.png` is labelled m/s but the units are world units per second.

## Revision 1 verdicts

| # | Chapter | Rev 0 | Rev 1 | Summary |
|---|---------|-------|-------|---------|
| 1 | awaken | FIX | **FIX** (one item, new) | All four rev-0 fixes are resolved or reduced to notes: the swing out and back, the key steps, the handles, and the dead tail. New: the 9.4–11.9 s wheel pause does not read as a stop, because the camera accelerates into its fastest orbit across it. |
| 2 | rise | FIX | **PASS with notes** | The head is live (7 px/s). The monitor glare is still present (grade). |
| 3 | create | FIX | **PASS with notes** | Both prop pops are gone and the 65° tilt reads. The clipped desktop is still present (grade). The easel portrait is now very tight. |
| 4 | commons | PASS w/ notes | **PASS with notes** | The desk base sits in the right third of the title box, but the real title ends at about x 650, so nothing collides. |
| 5 | coast | PASS w/ notes | **PASS with notes** | The casters now have floor under them. The chair sits behind the title, which stays legible. |
| 6 | oilers | FIX | **FIX** (narrowed) | The bottle and white table are now under the title only from 1.6 to about 4.3 s (was about 8 s). The fix is cheap: retime the title or add one camera key. |

Dissolves: no FIX. 4→5 has opposing horizontal drift, which is a note.

### Ch 1: awaken (23:35 render) — FIX (one new item)

| Rev-0 item | Status |
|---|---|
| **1a. Swing out and back around the low hero** | **Resolved.** The orbit now runs −32° (13.0 s) → −75° (16.4 s, low hero) → −83° (19.8 s, crane up to the portrait). It changes direction once, at about 20.5 s, inside the title-B portrait where on-screen speed is lowest. Camera speed peaks at 2.0 u/s at about 14 s (was 3.2 u/s at 17 s), with no near-stop at the low hero (`r1/motion-01.png`, `r1/sheet-01-02.jpg`, `r1/sheet-01-03.jpg`). |
| **S2. Steps at every key** | **Resolved by the tool** (508 keys, monotone-cubic timing). The camera-speed curve is smooth. The one remaining kink is geometric, not sampling: at 1.17–1.45 s, image motion swings from rightward (+7.8 px/frame) to downward (+6.4 px/frame) in about 0.3 s. The push across the wheel turns into the crane at the 1.4 s key, giving a peak acceleration of 0.9 px/frame² at 1.23 s. Note only: it's in the first 1.5 s, under the fade from black. To soften it, round the corner: move the 1.4 s key about 0.25 u toward +x, to roughly (1.40, 0.09, 1.30). |
| **S1. Handles** | **Resolved.** Head 62 px/s, tail 19 px/s. |
| **1b. Title-B lock-off** | **Reduced to a note.** Below 3 px/s only from 20.6 to 21.3 s (0.7 s), and below about 6 px/s for about 2.4 s (20.4–22.8 s). It's the orbit's turnaround point and the title payoff, so it's acceptable. For more life, add a 1° FOV push (26→25) over 19.8–23.0 s. |
| **1c. Dead tail** | **Resolved.** The full lift ends at 28.55 s. The push from 28.4 to 34 s is visible: distance 7.9 → 6.3 u, FOV 28→26, about 0.4 u/s, about 19 px/s on screen in the tail. |
| Silhouette foot room (6–7.5 s) | **Still tight**, note only. The casters sit at about y 1040 of 1080 at 7.0 s (`r1/sheet-01-01.jpg`). |
| Title zone | **Clean** with the real titles (`r1/titled-01a.jpg`, `r1/titled-01b.jpg`). Beat A: the wheel and leg stay right of the text, with a gap of about 80–150 px to the end of the detail line; the cyan pulse-ring arc runs thinly under the detail line at 4.5–6.5 s, which is acceptable. Beat B: the desk sits entirely right of the text. Title-box mean luma is 24 (beat A) and 15 (beat B). |

New note: at 5.9–6.2 s, on-screen motion drops to zero and drifts back at about 0.5 px/frame. The camera's path doubles back about 4° (5.4 s key at +19°, 6.9 s key at +23°), so the silhouette landing "bounces" slightly under title A. To make the arc monotonic, move the 5.4 s key to about +26°, roughly (5.15, 0.95, 2.05).

**New FIX 1d: the 9.4–11.9 s wheel pause does not read as a deliberate stop** (`r1/ch01-pause-9.0-12.3.jpg`)

During the pause, the camera accelerates from 0.6 to 1.9 u/s and orbits about 15°/s around the desk. Its peak speed of the whole chapter falls at 11–12 s. In a reference-free void, an orbiting camera around a stopped desk looks the same as a turning desk. The desk appears to swing from front-3/4 to front-on to 3/4 through the whole "pause" (9.0–12.3 s strip), and the real 45° turn at 11.9 s simply continues that motion. So the viewer sees no stop.

The desk is also not fully still: lift 1 runs until 10.9 s, so total stillness is only 10.9–11.9 s (1.0 s).

**Correction:**
1. **Hold the camera through the pause.** From the 9.6 s key, make only a slow push along the view axis to about (7.70, 1.85, 0.95) at 11.9 s, with the target fixed at (0.45, 1.39, 0.53). That's about 0.15 u/s and under 2°/s of orbit, so the desk's halt (and the end of the lift at 10.9 s) reads against a near-steady frame.
2. **Start the orbit as the desk turns.** Move the 13.0 s key (−32°) to about 14.3 s. The arc then runs 11.9–16.4 s with the desk's own 45° turn. Covering +8° to −75° in 4.5 s peaks at about 2.3 u/s. If that's too brisk, set the low hero at about −60° (about (4.4, 0.4, −6.3)): the desk's turn already brings its front round, so a shorter arc gives the same 3/4.
3. **Optional, if the beat still feels short:** extend total stillness to 1.5 s. Move the turn to 12.4–15.1 s, lift 2 to 15.5 s and the tilt to 16.6 s, and shift the 16.4 s and 19.8 s keys by +0.5 s. The tilt still lands at the start of title B.

The dissolve into ch 2 (`r1/dissolve-01-02.jpg`) is fine. Ch 1's tail drifts (−18, +6) px/s and ch 2's head (+3, +10) px/s, both slow, and they don't fight.

### Ch 2: rise — PASS with notes (was FIX)

| Prior item | Status |
|---|---|
| Frozen head (1.6 px/s, static to 1.7 s) | **Resolved.** The head moves at 7 px/s from frame 0 and the tail at 11 px/s. |
| Crane-down landing braking in steps (10.4–12.9 s) | **Resolved.** The added 12.3 s key softens it; the largest step is now 1.29→1.66 px/frame at 12.37 s, not visible. |
| Bright title zone | Partly changed: the plant pot has left the frame. The title box (1.6–7.5 s) still averages luma 137 over the pale cabinet and desk leg. You're grading and scrimming this; it's legible in the mock (`r1/titled-02.jpg`). |
| Monitor glare | **Still present** (9.5–16 s, upper-left of the portrait monitor; `r1/sheet-02-02.jpg`). You're handling it in the grade. |

New: the chair back on screen-right is larger in the opening, but measures 12–14% of the frame at 0.4–1.6 s, under the 20% cap. No regressions.

### Ch 3: create — PASS with notes (was FIX)

| Prior item | Status |
|---|---|
| Prop pop at 2.967 s | **Resolved.** `initial.tilt` = 12°, so the desk opens already stowed. A block-wise local frame-difference scan of the whole chapter finds no one-frame change above 1.7 luma levels. |
| Mug pop at ~10.53 s | **Not visible in the mkv.** In the shelf crops at 10.0 / 10.4 / 10.5 / 10.533 / 10.6 s (`r1/ch03-shelf-crops.jpg`), the shelf behind the monitor shows no change at the easel threshold, and the local-difference scan is clean around 10.5 s. From about 12 s, the stowed mugs come into view from behind the monitor arm by parallax, not by popping (14–18 s). That's minor clutter, not a defect. |
| Clipped white desktop | **Still present.** Title box p95 = 255 throughout 1.6–7.5 s; the desktop is the whole lower-centre. You're handling it in the grade and scrim; readable in `r1/titled-03.jpg`. |
| 65° doesn't read | **Mostly resolved.** The camera is now beside the desk at about 1.6 u, and the board's leading edge runs at about 60° against the window wall (`r1/ch03-full-14.0.jpg`, `r1/ch03-full-17.5.jpg`). The angle reads. |
| Frozen tail | **Resolved.** The tail moves at 18 px/s, the head at 14 px/s. |

Notes:
- The easel portrait (12–18 s) is now very tight. The desk is cut by the top, right and bottom edges, and the white board plus side panel fill about 40% of the frame. It reads as a detail rather than a portrait of the desk. If there's room, back off about 0.3 u at the 14 and 18 s keys.
- The black keyboard-tray wedge still sits cut by the bottom edge (around x 1090–1200 at 14–18 s). From 8 to 10 s it's a large glossy blob at the bottom centre.
- In the title mock, the black keyboard tray sits under the end of "creation." and the detail line from 1.6 to 5 s. Readable, but busy.

### Ch 4: commons — PASS with notes (unchanged)

Handles move at 28 / 41 px/s, the speed profile is smooth, and there are no pops. The ending is improved: the desk is larger, and the wheelchair is cropped toward the corner (`r1/ch04-full-13.5.jpg`). In the new title box (x 96–1060), the desk's casters and cyan underglow fill x ≈ 780–1060, y ≈ 820–1000 throughout 1.6–7.5 s while the desk rolls. With the real title track burned in, though, "A place for everyone." and its detail line end at about x 650, so nothing overlaps the desk (`r1/titled-04.jpg`). Keep the title width as it is. A longer detail line would collide with the rolling desk. The opening still reads as a corridor more than a commons, as before.

### Ch 5: coast — PASS with notes

The camera is about 0.25 u lower, and the end frame now leaves floor under the hero desk's casters (resolved). Motion is smooth. Handles move at 72 / 62 px/s, which is fine but brisk: these are the fastest heads and tails in 2–6. The title box (1.6–7.5 s) still holds the black task chair and its chrome base (1.6–3.5 s, then the left station's chair at 6–7.5 s). In the mock (`r1/titled-05.jpg`, 6.5 s), the chair sits behind "Ideas become stories." and the detail line, which stay legible over the dark chair and scrim. No green screen (documented).

### Ch 6: oilers — FIX (narrowed)

| Prior item | Status |
|---|---|
| Red bottle, notebook and white table in the title zone until ~8 s | **Improved but not resolved.** They are now clear by about 4.5 s (was ~8 s). The title fades in at 1.6 s, so the first ~2.7 s of the title still sit over them. With the real title track (`r1/titled-06.jpg`): at 2.0 s, "Room to discover." is fading in over the white tabletop next to the red bottle and is barely legible; at 3.5 s the bottle stands through the detail line under "for every". From 4.5 s it's clean. |
| Tabletop over 20% of the frame for ~2.5 s | **Resolved in practice.** The white-top area measures 13–17% at 0.6–1.4 s and under 10% from 2.2 s. It peaks just after the handle and is clearly motivated. |
| Near-frozen tail | **Resolved.** The tail moves at 32 px/s. |

**Remaining FIX (6a, 1.6–4.3 s).**
- **Option A (camera):** add a key at about 3.0 s at roughly (1.40, 2.32, 1.62), pushing over the table, so the bottle and table corner pass under the frame bottom by about 3.0 s. Keep the 5, 8 and 11 s keys.
- **Option B (cheapest, no re-render):** set ch 6's title `rel_in` to about 4.3 s and `rel_out` to about 9.8 s. The background behind the title is clean from 4.5 to 11 s.
- Either alone is enough.

### Dissolves (simulated, 1.5 s cross-fade, `r1/dissolve-AA-BB.jpg`)

Mean image flow over the last and first 1.5 s (px/s; +x means content moves right):

| Dissolve | A tail | B head | Read |
|---|---|---|---|
| 2→3 | (−10, +2) | (+14, 0) | Both near-still and the monitors overlap; reads as a soft match. Fine. |
| 3→4 | (+17, 0) | (−31, −1) | Opposing, but slow. Fine. |
| 4→5 | (−51, +2) | (+69, +5) | Opposing horizontal motion at moderate speed. The two layers slide past each other for about 1 s. Noticeable to an editor's eye, minor for a viewer. Note. |
| 5→6 | (+63, −12) | (−13, +53) | A lateral slide into a pedestal up. Different axes, so they don't fight. Fine. |
| 6→7 | (−32, +1) | (+16, +1) | Opposing, slow. Fine. |

None of these needs a FIX. To clean up 4→5, end ch 4's last 1.5 s with content drifting screen-right: arc the 12.6→14 s keys about 4° the other way, so ch 4's tail continues into ch 5's slide.

## Revision 1: remaining FIX list

1. **Ch 1, 9.4–11.9 s:** the pause doesn't read as a stop, because the camera orbits at its peak speed (1.9 u/s, about 15°/s) across it.
   - Hold the camera with a slow push from the 9.6 s key to about (7.70, 1.85, 0.95) at 11.9 s, keeping the target fixed.
   - Move the 13.0 s orbit key to about 14.3 s, so the arc starts with the desk's turn at 11.9 s.
   - If the arc gets too fast, pull the low hero in to about −60°, around (4.4, 0.4, −6.3).
   - Optionally extend the rest by 0.5 s: turn 12.4 s, lift 2 15.5 s, tilt 16.6 s, keys +0.5 s.
2. **Ch 6, 1.6–4.3 s:** "Room to discover." fades in over the white student tabletop beside the red bottle (barely legible at 2.0 s), and at 3.5 s the bottle stands through the detail line. Either fix is enough:
   - (a) Set the title's `rel_in` to about 4.3 s and `rel_out` to about 9.8 s. No re-render needed.
   - (b) Add a camera key at about 3.0 s at roughly (1.40, 2.32, 1.62), so the table and bottle exit the frame bottom by about 3 s.

## Revision 1: notes (no FIX)

- **Handled in the grade or scrim, and still present in the renders:**
  - ch 2: monitor glare at 9.5–16 s; bright title zone (box mean luma 137);
  - ch 3: clipped desktop (title-box p95 = 255 at 1.6–7.5 s).
- **ch 1:**
  - corner in the path at 1.2–1.45 s;
  - 4° bounce at the 6.0 s silhouette landing;
  - tight foot room at 7 s;
  - 0.7 s near-lock at 20.6–21.3 s.
- **ch 3:**
  - the easel portrait (12–18 s) crops the desk on three sides; back off about 0.3 u;
  - the black keyboard-tray wedge is cut by the bottom edge;
  - stowed mugs peek out behind the monitor arm from 12 s (by parallax, not a pop).
- **ch 4:** with the current title width there's no collision. Keep the commons detail line at or under its current length, or it will run into the rolling desk's casters at x ≥ 780.
- **4→5 dissolve:** the two layers drift in opposite directions (−51 vs +69 px/s). To join them, arc ch 4's 12.6→14 s keys about 4° the other way.

## Revision 1, addendum: ch 1 re-render at 23:49:40 (shot JSON 23:42)

A newer `renders/01.mkv` landed after the ch 1 review above, which was based on the 23:35 file. I re-checked it. Evidence is in `evidence-a/r2/`.

- **1d (the pause): resolved.** From the 9.6 s key the camera holds: 0.12–0.3 u/s, about 4–6 px/s on screen across 9.6–13.5 s (`r2/motion-01.png`). So the desk visibly finishes its lift (10.9 s), sits still until 12.4 s, then turns 45° on its own against the held frame (`r2/ch01-pause-9.0-15.5.jpg`). It now reads as a deliberate stop and a deliberate turn. The only stretch below 3 px/s is 12.57–13.07 s (0.5 s).
- The 1.4 s and 5.4 s keys follow my suggestions. Peak acceleration falls from 0.9 to 0.55 px/frame² (at 1.37 s). Handles are 56 / 19 px/s. Title A is still clean (`r2/titled-01a.jpg`), though at 4.5 s the leg comes within about 40 px of the end of the detail line.
- **New FIX 1e (regression): title B now collides with the desk.** The re-blocked portrait (low hero at −9°, portrait at −14°) puts the desk centre-left. Throughout 16.0–22.5 s, the desk's left leg and its red edge line sit directly behind "health." and the end of the detail line, "…feel your best." (x ≈ 760–900; `r2/titled-01b.jpg` at 17.0, 19.0 and 21.5 s).
  - **Correction:** shift the desk about 250 px screen-right for 16–22.5 s, so its left leg sits at x ≥ 1000. At FOV 26 that's about a 6° pan screen-left: move the targets of the 17.4, 20.3 and 23.0 s keys about 0.8 u perpendicular to the view, toward screen-left, and ease back by 25 s.
  - Alternatively, swing those camera positions about 6° further around the desk in the direction that moves it screen-right.
  - Verify with a titled still at 17, 19.5 and 22 s.

Ch 1 therefore stays **FIX**, but the only open item is 1e (title B placement). 1d is closed.

## Revision 1, final ch 1 check: render 23:59:34 (shot JSON 23:53) — PASS

Evidence is in `evidence-a/r3/`.

- **Title-B clearance (1e): resolved.** With `titles.ass` burned in, the desk sits fully right of the text across the whole beat: about 100 px clear at 16.5 s, then 180–250 px from 17.5 to 22.4 s (`r3/titled-01b-1.jpg`, `r3/titled-01b-2.jpg`).
- **Pause, 9.4–12.4 s: reads as a stop.** On-screen motion eases from 31 px/s (9.0 s) to 4–7 px/s (10.5–12.5 s). The desk finishes its lift, rests, and turns at 12.4 s against a near-steady frame. Nothing drops below 3 px/s for 0.5 s or more, so it isn't a freeze.
- **Handles:** head 55 px/s, tail 14 px/s. The largest one-frame speed change is 36 px/s (~1.2 px/frame), which isn't visible.
- **Title A:** unchanged and clean (`r3/titled-01a.jpg`).

**Ch 1: PASS.** Ch 6 remains the only open FIX in chapters 1–6, a title-timing or one-key fix at 1.6–4.3 s.
