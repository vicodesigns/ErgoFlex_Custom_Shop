# Picture-lock review B: chapters 07–12

Reviewer: independent (film-review agent B), 2026-10-29. Sources: `renders/07–12.mkv` (1080p30, ungraded, textless), `shots/07–12.json`, `TREATMENT.md`. I formed these verdicts from the frames and measurements below before I read `review/NOTES.md`. Where I disagree with the DP's notes, I say so at the end.

Method:
- 0.5 s contact sheets for every chapter.
- Full-res stills wherever something looked off.
- 8-consecutive-frame strips in the fastest moves.
- Per-frame motion metrics: mean absolute luma difference plus phase correlation over all frames, with MD5 duplicate detection, `freezedetect` and `mpdecimate`.
- Camera speed profiles sampled from each shot's baked `camera.keys`.
- Camera travel inside the 1.5 s dissolve windows.
- The final `final/titles.ass` burned onto the chapter frames, to check the title zone with the real typography.
- Simulated 1.5 s dissolves at every chapter boundary in my scope.

All evidence is in `review/evidence-b/`. The scripts that produced the numbers are `motion.py`, `camspeed.py` and `handles.py`, and their outputs are `framediff-NN.txt`, `camspeed-NN.txt` and `dissolve-window-travel.txt`.

## Verdicts

| Ch | id | Verdict | One-line reason |
|----|----|---------|-----------------|
| 07 | wellness | **FIX** | During the signature lift (6.3–8.6 s) the casters are cut off by the bottom frame edge and the monitor touches the top. A two-step gear change at 7.9/8.2 s. The title sits over the desk base and the white-hot underglow. |
| 08 | awareness | **FIX** | The crane at 2.4–6.6 s is a whip: up to 4.5 m/s and 31°/s, with a mid-move surge. The desk's forward roll at 6–9.5 s can't be seen. A bright pylon crosses the title zone at 5–6.5 s. |
| 09 | music | **FIX** | The payoff (9–14 s) is a near-black, cropped side panel, not a desk. A speed step at 5.9 s. The whole-room rainbow wash reads as an RGB demo, not "dark, moody" (scene issue). |
| 10 | media | **FIX** | The on-screen picture is a frozen, murky still, and no ambient spill is visible, so the chapter's promise is never shown. The camera stops at 9.4 s and restarts at 10.2 s. |
| 11 | storage | **FIX** (small) | Clean, readable tilt, roll and rise with no ceiling wedge. But the crane kicks in at 11.0 s (×16 segment speed), the first ~2.5 s are locked off, and the "open floor" payoff still has the task chair sitting in it. |
| 12 | hero | **PASS with notes** | Good end-card geometry and a clean title zone. The hero desk is very dark, the push-out decelerates in two visible steps at 8.85/9.10 s, and the "orbit" is mostly a pull-back. |

Systemic (applies to all six, and is the most important fix):
- **S1, the dissolves land on frozen cameras.**
- **S2, velocity stepping wherever segment speeds differ.**

Both are explained below.

---

## Systemic issues

### S1. Every chapter starts and ends at rest, so every dissolve joins two locked-off frames (FIX)

`camera-spline.mjs` ramps a move from rest at its first key and to rest at its last key. With `ease: 0.3–0.35`, that ramp lasts 30–35% of the whole move, which is 4–5 s per chapter. The chapters overlap by `dissolve: 1.5` s (`edl.json`), so the full first and last 1.5 s of each chapter sit inside a dissolve. Camera travel inside those windows (`dissolve-window-travel.txt`):

| Ch | head 0–1.5 s | tail last 1.5 s | distance to subject |
|----|----|----|----|
| 07 | 4.4 cm, 0.03° | 14.6 cm, 1.9° | ~5 m |
| 08 | 10.7 cm, 0.2° | 19.4 cm, 0.05° | 3.7 / 8 m |
| 09 | 7.5 cm, 0.5° | 5.7 cm, 1.1° | 4.5 / 3 m |
| 10 | 7.6 cm, 0.2° | 5.2 cm, 0.2° | 4.8 / 3.2 m |
| 11 | **1.7 cm, 0.02°** | 27 cm, 1.4° | 5.8 / 7.6 m |
| 12 | 15.6 cm, 1.0° | 12.2 cm, 0.35° | 9 / 13 m |

The frame-difference data confirms this:
- ch 11, 0–1.2 s: mean diff 0.04–0.15. Effectively a still.
- ch 07, 0–0.5 s: 0.07–0.20.
- ch 10, 13.7–14 s: 0.08–0.24.
- ch 12, 0–0.4 s: 0.10–0.17.

The worst boundary is **10 → 11**. A 5 cm tail dissolves into a 1.7 cm head, so the viewer sees the camera stop, a cross-fade between two stills, then a start (`trans-10-11-dissolve.jpg`). That is the 10-29 stop-start problem, moved from the keys to the chapter boundaries.

For comparison, the DP-A chapters (1–6) use `ease 0.04–0.12` and don't show this.

**Fix:** set `cameraPlan.ease` to **0.08–0.10** on 07–12. The ramp then completes inside the first and last ~1.2–1.5 s, and the camera is at cruise speed as each dissolve clears. Re-check the mid-move speeds after the change (see S2). A cleaner long-term fix is an `easeIn` / `easeOut` (or `carry`) option in `camera-spline.mjs`, so a chapter can enter and exit at speed. That is a tool change for the lead to decide.

### S2. Linear-key velocity stepping, visible wherever consecutive segments have different speeds (note → FIX where it is large)

The spline is baked into ~58 linear keys, about one every 0.25–0.3 s. The camera's velocity is therefore piecewise-constant. Where the authored segments run at very different speeds, the acceleration happens in discrete jumps every ~8 frames. The frame-difference metric holds flat for 7–8 frames, then jumps 30–70% in one or two frames:

| Ch | t (s) | step | segment speeds either side |
|----|----|----|----|
| 07 | 7.90, 8.17 | diff 1.03 → 1.72, 1.76 → 2.32 | 0.10 m/s, 0.8°/s → 0.36 m/s, 5.4°/s |
| 08 | 2.53, 2.97, 3.40, 4.63 | +35–40% steps; peak accel 24 m/s² at 4.63 | 0.22 → 1.58 → 2.41 m/s |
| 09 | 5.90, 6.17 | 1.45 → 2.15 | 0.20 → 0.37 m/s, 1.7 → 4.9°/s |
| 11 | 11.03, 11.33 | 1.53 → 2.02 → 2.66 | 0.05 → 0.82 m/s (×16) |
| 12 | 8.85, 9.10 | 0.91 → 0.66 → 0.40 | 0.86 → 0.32 m/s |

In real-time playback these read as slight hitches (gear changes), not jolts. The 8-frame strips look smooth frame to frame (`07-strip8-7.8s.jpg`, `09-strip8-5.8s.jpg`, `12-strip8-8.75s.jpg`), so I rate this a note except where the speed ratio is extreme (08 and 11).

**Fix:** retime or reposition the story keys so that neighbouring segments have similar speeds (m/s and °/s). Specific numbers are given per chapter below. Raising `samples` only helps up to the tool's 64-key cap.

---

## 07 wellness: **FIX**

Evidence: `07-contact-0.5s.jpg`, `07-rise-bottom-crop-5.5-9s.jpg`, `07-full-7.0s.jpg`, `07-full-7.6s.jpg`, `07-full-14.6s.jpg`, `titles-burned-07.jpg`, `07-strip8-7.8s.jpg`.

1. **The product is cut off during the signature lift (6.3–8.6 s).**
   - What's wrong: at 7.0 s and 7.6 s, the front-right caster is clipped by the bottom frame edge. The wheel runs to y≈1080, and the floor under the base is gone. At the same moment the monitor's top edge touches y≈0. The desk overfills the frame top and bottom at exactly the moment the viewer should see the whole desk rise.
   - Cause: the 8.2 s key (2.60, 1.60, −1.55) is ~0.37 m closer than the 3.0 s key (2.65, 1.22, −1.92), so the camera pushes in while it pedestals up.
   - Fix: keep the subject distance constant through the lift. Move the 8.2 s key back to about **(2.72, 1.60, −1.85)** and/or widen it to **FOV 40**, and lower its target y from 1.30 to **~1.18**. Aim for ≥50 px of floor under the casters and ≥40 px of headroom over the monitor at 6.5–8.5 s.
2. **Gear change at 7.9 s and 8.2 s.**
   - What's wrong: the 3.0 → 8.2 segment turns at 0.8°/s and the 8.2 → 11.6 segment at 5.4°/s. The arc starts with a two-step lurch (frame diff 1.03 → 1.72 in two frames at 7.90 s, then 1.76 → 2.32 at 8.17 s).
   - Fix: start the arc earlier and spread it. Move the 8.2 s key to **7.2 s** and add a key at **~9.6 s** halfway along the arc, so the aim rate builds through roughly 1 → 3 → 5°/s. Or apply S1's lower ease and let the arc run 7.2 → 15.0 s at constant speed.
3. **The title zone holds hero action and the brightest highlight.**
   - What's wrong: with the real `titles.ass` burned in (`titles-burned-07.jpg`), "Make movement part of your day." (x 128–~900, y ~780–970) runs across the planter, then the desk's front-left caster, then the underglow pool. The pool is the hottest part of the frame (p99 247, 0.3% of pixels clipped). The lift is happening right behind the end of the title from 3 s to 7.4 s.
   - Fix: rotate the opening aim ~4–5° screen-left, or slide the 0 s and 3 s keys ~0.3 m toward the strength-rack side, so the desk sits in the right 55–60% of frame for 0–7.5 s. Trim the underglow in the grade (`grade.json`) if the scene can't be changed.
4. **Note: weak gym reveal and a flat last frame.**
   - What's wrong: the "slow arc to reveal the gym" ends on a square-on frontal elevation (14.6 s). Only a dumbbell rack and a bench edge read as "gym", and the window is out of frame. The light reads only as a floor patch.
   - Fix: stop the arc ~15° short of square, for example with the last key at about (3.85, 1.85, 0.15), so the desk stays 3/4 and the window light rakes across it. Alternatively, let the final key keep more of the rack in frame.
5. **S1:** the head is still for ~0.5–1 s (4.4 cm over 1.5 s).

Flow into 08: the last move is an arc screen-right with a slight crane up, landing frontal. 08 opens with a low push. The change of scale works, and the dissolve overlay is clean (`trans-07-08-dissolve.jpg`).

## 08 awareness: **FIX**

Evidence: `08-contact-0.5s.jpg`, `08-full-2.0s.jpg`, `08-strip8-3.2s.jpg`, `08-strip8-4.5s.jpg`, `08-full-4.0s.jpg`, `08-full-4.6s.jpg`, `08-full-5.2s.jpg`, `08-full-11.8s.jpg`, `08-desk-travel-6.0-vs-9.5s.jpg`, `titlezone-all.jpg`, `titles-burned-08.jpg`.

1. **The crane (2.4–6.6 s) is a whip, not a premium move.**
   - What's wrong: the authored segments run at 0.22 → **1.58 → 2.41** → 0.40 m/s. The sampled peaks are **4.45 m/s and 31.5°/s** at ~5.0 s. That is ~1° per frame at FOV 26–28, roughly 60–70 px of image motion per frame at 1080p. The aim speed also surges: 28°/s at 3.5 s, down to 22.7°/s at 4.0 s, back up to 31.5°/s at 5.0 s (frame diff 8.7 → 3.9 → 5.7, peak acceleration 24 m/s² at 4.63 s). The viewer will feel a lunge, then a second lunge. The 8-frame strip at 3.2 s shows the desktop sweeping through the top of frame edge-on, with ~100 px/frame of displacement.
   - Fix: give the crane more time and less distance.
     - Hold the low shot until ~1.8 s, while the pylons are still rising.
     - Crane from **1.8 s to ~7.5 s**.
     - Top out at **y≈7.5** instead of 10.
     - Add a mid key (about (3.6, 3.2, 0.4) at ~4.2 s) so both halves run at about the same speed.
     - Target ≤12°/s peak aim rate and ≤2 m/s.
2. **3.8–4.8 s: the monitor's black back is cropped by the top edge** (`08-full-4.0s.jpg`). The 830 × 150 px black slab touches y=0. This is a note. It is resolved if the crane in fix 1 rises later or frames ~5° higher.
3. **Title zone, 5.0–6.5 s.**
   - What's wrong: a large saturated-blue pylon sweeps across the lower-left corner (`08-full-5.2s.jpg`: x 0–190, y 780–1020). It moves fast, during the crane, while "Move with awareness." is on screen (title 1.6–7.2 s). The top-down only squares up at ~7 s. Until then the frame is rolled 4–6° (compare 6.0 s and 9.5 s in `08-desk-travel-6.0-vs-9.5s.jpg`).
   - Fix: land the top-down by ~6.0 s with no pylon in the bottom-left 640 × 360 px. Rotating the final top-down heading 90°, so the desk travels screen-up, also puts the pylons in the upper corners.
4. **The signature move can't be read.**
   - What's wrong: the wheels clip moves the desk 9.67″ (~0.25 m) at 6.0–9.5 s. From 8–10 m up, that is ~5% of frame height. The simultaneous 2.1 m push-in (scale change) masks it completely. Comparing the 6.0 s and 9.5 s stills, the desk sits in the same place in frame. "Proximity sensing keeps every move clear" needs a visible move toward something.
   - Fix:
     - Hold altitude constant during 6.0–9.5 s and push only after the move.
     - Frame tighter, at about y≈6 (0.25 m ≈ 9% of frame).
     - Keep a pylon in the direction of travel so the approach and the sweep reading are legible.
     - A lower oblique (~60° pitch) instead of a true top-down would also read the travel against the grid.
     - Within the brief's ≤1.5× limit, you could also start the roll at 6.5 s and shorten it to 2.6 s so it reads as a decisive move.
5. **S1:** the tail decelerates to rest (diff 0.08–0.24 from 11.6 s on). Flow into 09 (a descending push into a descending push) is compatible.

What works: the void is dark and premium, the 0–2.4 s low base shot is handsome, and the end composition is symmetric and centred (`08-full-11.8s.jpg`).

## 09 music: **FIX**

Evidence: `09-contact-0.5s.jpg`, `09-full-3.0s.jpg`, `09-full-7.0s.jpg`, `09-full-10.0s.jpg`, `09-full-13.6s.jpg`, `09-strip8-5.8s.jpg`, `titles-burned-09.jpg`.

1. **The payoff (9.0–14.0 s) is a crushed crop, not the hero.**
   - What's wrong: the camera ends ~1 m from the desk's side C-frame (0.40, 1.02, 2.55 at FOV 44). From 10 s the side panel is a near-black mass over ~40% of frame: 24% of all pixels have luma < 8 at 10 s, and 20% at 13.6 s. The monitor is cut by the top edge and the casters by the bottom edge, and the desktop runs off frame left. "Catch the light" catches a thin green LED line on a black slab. It reads as underexposed and unfinished, and it is the frame the viewer carries into ch 10.
   - Fix: keep the low lateral but end wider and further back. Use a last key at about **(0.95, 1.20, 2.95), target (−0.85, 0.95, 0.0), FOV 40**, so the whole desk (monitor top to casters) is in frame with the lit desktop edge leading. If the move has to stay low, keep ≥1.8 m from the panel.
2. **Speed step at 5.9 s.**
   - What's wrong: the segments run at 0.20 m/s and 1.7°/s, then 0.37 m/s and 4.9°/s, then 0.15 m/s and 2.8°/s. The frame diff jumps 1.45 → 2.15 at 5.90 s and again at 6.17 s.
   - Fix: move the 5.5 s key to **~4.5 s**, or move its position ~0.35 m further along the path, so the first two segments both run at ~0.27 m/s.
3. **Look (scene issue, report to the lead).**
   - What's wrong: the whole room (walls, floor, cabinets, chair) is washed in one fully saturated hue that rotates red → yellow → green → cyan → blue → violet → magenta about every 6 s (`09-contact-0.5s.jpg`; at 7.0 s the entire room is mustard yellow, `09-full-7.0s.jpg`). The brief asks for "dark, moody" with "reactive light on the surfaces". This reads as a uniform RGB demo with no beat. It also makes the title background change from green to violet to orange under "Feel the room come alive.", so legibility changes.
   - Fix (scene, not camera): drop the room's ambient fill so colour lives only on LED-lit surfaces, slow the wheel (≥12 s per cycle) or key it to the score's beats, and keep the walls near black between hits.
4. **Note: title zone.** The planter, the desk's front-left caster and the neon rug border sit under the title at 1.6–7.2 s (`titles-burned-09.jpg`). Pan the opening ~3° screen-left so the desk base clears x < 900.

Flow: the final move is a descent with a truck screen-left, low. 10 opens with a push in toward screen-left, which is compatible.

## 10 media: **FIX**

Evidence: `10-contact-0.5s.jpg`, `10-full-0.4s.jpg`, `10-full-4.8s.jpg`, `10-full-9.8s.jpg`, `10-strip8-9.6s.jpg`, `10-screen-9.5s.png`, `10-screen-10.15s.png`, `ref-screen-film-every3s.jpg`, `trans-10-11-dissolve.jpg`, `titles-burned-10.jpg`.

The lamp occlusion is gone: confirmed in every frame.

1. **The picture is frozen, and the room never responds (blocking for this chapter's message).**
   - What's wrong:
     - The screen shows the same dark, smeared "fence" image from 0 s to 14 s.
     - During the camera rest at 9.4–10.2 s the whole frame is static: mean diff ≤0.15, an exact duplicate frame at **9.83 s** (frame 295), and only 0.84 mean difference on the screen crop between 9.5 s and 10.15 s, all of it from camera drift.
     - At FOV 31 the screen fills ~40% of frame, and the content is visibly low resolution and murky (`10-full-9.8s.jpg`).
     - No screen-coloured spill reaches the desk, wall or ceiling. The room is lit warm by the lamps.
     - The title says "Ambient color that follows every scene." Nothing follows anything.
     - `post/screen-film.mp4` (a 20 s sunset; see `ref-screen-film-every3s.jpg`) exists but does not appear in the render.
   - Fix (scene or post, not camera): play the screen film in the stage during the render, with its bias or ambient light on so the wall and desktop visibly shift hue. Or, as a fallback, composite `screen-film.mp4` onto the screen in post with a 4-corner track (the screen corners barely move after 9 s) and add a matching colour spill in the grade. The hold only works once the picture moves.
2. **Stop, then start, at 9.4–10.2 s.**
   - What's wrong: the camera decelerates to 0.002 m/s, rests ~0.8 s, restarts to only 0.065 m/s, then decelerates again into the tail. With a frozen picture this reads as a freeze. Even with a moving picture, the restart is the stop-start the brief bans.
   - Fix: delete `"hold": 0.4` on the 9.6 s key and let the push run through as one move. Let the last segment (9.6 → 14 s) carry ~0.05 m/s constant (with S1's lower ease), or end the dolly at 14 s at FOV 29.
3. **Note: chair at 3.5–6.5 s.** The black chair back crosses frame right at ~15–19% of the frame (`10-full-4.8s.jpg`). It is under the 20% cap, but it is a hard-edged black slab, not "soft at the edge". Keep it but trim ~3%: move the 5.0 s key 0.15 m toward −z, or let the chair exit 0.5 s earlier.
4. **Note: title zone.** The large grey planter sits dead centre under the title (x 40–310, y 700–1000), with the rug grid and the desk's front-left caster at the title's end (`titles-burned-10.jpg`). Slide the opening ~0.3 m toward the window so the planter leaves frame left before 1.6 s, or accept it as a calm dark-ish element. The rug is the busier problem.
5. **S1:** this is the worst outgoing tail (5.2 cm over 1.5 s) into the worst incoming head (ch 11, 1.7 cm).

Flow: the final move is a push in, settling. 11 opens static (see S1), so this transition needs the most help.

## 11 storage: **FIX (small)**

Evidence: `11-contact-0.5s.jpg`, `11-full-0.4s.jpg`, `11-full-10.0s.jpg`, `11-full-13.0s.jpg`, `11-full-16.6s.jpg`, `11-strip8-10.9s.jpg`, `titles-burned-11.jpg`, `trans-11-12-dissolve.jpg`.

Strong points:
- The tilt to 65° reads clearly.
- The roll along the wall reads, and the camera pans with it nicely (10.0 s is the best frame in this batch).
- The rise has no ceiling or wedge.
- The desk is the clear subject throughout.

1. **The crane kicks in at 11.0 s.**
   - What's wrong: the 6 → 12 s segment runs at 0.05 m/s and 1.2°/s, and the 12 → 17 s segment at **0.82 m/s and 6.6°/s**. The sampled speed goes 0.13 → 0.58 → 0.94 m/s in under a second (peak acceleration 9.9 m/s² at 11.03 s), with frame-diff steps at 11.03 s and 11.33 s.
   - Fix: add an intermediate key at **~13.5 s around (−0.25, 3.0, −6.6)**, target (−1.8, 0.8, −11.8), and move the "Track the roll" key to ~11.0 s. The rise then builds at about 0.05 → 0.4 → 0.8 m/s. Alternatively, start the rise at 10.5 s and end it at 17 s.
2. **0–2.5 s is effectively locked off, and 0–6 s barely drifts.** The camera moves 1.7 cm in the first 1.5 s and 0.32 m in the first 6 s, at 5.8 m from the subject. Combined with S1, it is static into and out of the 10 → 11 dissolve. Fix: S1's lower ease, plus a slightly stronger opening drift, for example the 6 s key 0.25 m further along the push.
3. **The payoff contradicts the line.**
   - What's wrong: "Roll to the wall. The floor is yours." But the final frame (16.6 s) has the task chair standing in the middle of the "open floor" mat. The bottom edge cuts a green commons chair back hard (x 580–800), and a white table corner is cut at the right edge (x 1640–1920).
   - Fix: tilt up ~5° (final target y 0.35 → ~0.75), which drops the cut chair out of the bottom. Swing the final position ~0.4 m toward −x so the table corner leaves frame right. If the scene allows, roll the task chair aside with the desk, or frame it at the left third rather than the centre of the mat.
4. **Note: title zone.** The task chair (black, with a high-contrast five-star base) sits under "Make room for what's next." for the whole title (`titles-burned-11.jpg`), and the bottom of the tilting desk is at the title's end at 4–6.5 s. Truck the opening ~0.3 m screen-right so the chair sits right of x≈900.

Flow into 12: the final move is a crane up and pull back. 12 opens on a slow orbit with the desk in a similar screen position. The overlay in `trans-11-12-dissolve.jpg` is the nicest match in the batch.

## 12 hero: **PASS with notes**

Evidence: `12-contact-0.5s.jpg`, `12-full-0.4s.jpg`, `12-full-3.0s.jpg`, `12-full-6.5s.jpg`, `12-full-13.6s.jpg`, `12-strip8-8.75s.jpg`, `titles-burned-12.jpg`.

- **Title zone:** clean. The desk sits right of centre for "Your space. Reimagined." The pulse ring touches the end of the detail line only (`titles-burned-12.jpg`).
- **End-card geometry:** correct. From ~9 s the desk is centred in the upper-middle (base at ~y 590 of 1080 at 13.6 s) and the lower half is clean near-black. The last ~2 s are near-static, which the brief allows.

1. **Note: the hero is very dark.** Frame mean luma is 11–13, and the desk's body (side panels, desktop, monitor) sits at roughly luma 10–30 against a void at ~9. It reads only by its red rim and silver struts (`12-full-3.0s.jpg`). As the last image of the film it looks moody but under-lit. Fix: per-chapter trim in `grade.json` (around gamma 1.15 and contrast 1.05 on `hero`), or a soft key from camera-left in the product void if the scene can be touched.
2. **Note: two-step deceleration at 8.85 s and 9.10 s.**
   - What's wrong: the 6.8 → 9.8 s segment runs at 0.86 m/s and hands off to 0.32 m/s. The frame diff drops 0.91 → 0.66 → 0.40 in two steps.
   - Fix: move the 9.8 s key to **~10.6 s**, or pull its position ~0.6 m back toward the 6.8 s key, so the last two segments run at about the same speed.
3. **Note: the move is mostly a pull-back.** It is "orbit" in name only: about 17° of arc over 14 s while the camera recedes 4 m and drops 1.65 m. For a "slow, reverent orbit", let the 0 → 6.8 s section sweep ~30° at constant radius before the push-out starts.

---

## FIX list (priority order)

1. **S1, all chapters:** handles and dissolve windows are at rest, so the dissolves join near-stills (worst: 10 → 11). Set `ease` to 0.08–0.10 on 07–12, or add ease-in/out = 0 to the tool, and re-render.
2. **10:** frozen, murky screen picture and no ambient spill. Get the film playing with spill (stage), or composite `post/screen-film.mp4` and add spill in post. Remove the 9.6 s `hold` (stop/restart at 9.4–10.2 s).
3. **09:** the 9–14 s ending crushes and crops the hero. End wider: ~(0.95, 1.20, 2.95) → target (−0.85, 0.95, 0), FOV 40. Rebalance the 5.5 s key (step at 5.9 s). Raise the rainbow wash with the lead as a scene issue.
4. **08:** slow and lengthen the crane (1.8 → 7.5 s, top y≈7.5, mid key ~4.2 s, ≤12°/s). Make the 6–9.5 s roll readable (hold altitude, frame tighter, keep a pylon in the travel direction). Keep the pylon out of the lower-left during the title.
5. **07:** hold distance through the lift so casters and monitor stay in frame at 6.3–8.6 s (8.2 s key → ~(2.72, 1.60, −1.85), FOV 40, target y ~1.18). Start the arc at ~7.2 s with a mid key at ~9.6 s. Shift the opening so the desk base and underglow clear the title.
6. **11:** add a ~13.5 s key so the rise builds instead of kicking at 11.0 s. Get the task chair out of the "open floor" payoff and the cut chair and table out of the final edges.
7. Notes only: 12 exposure and steps, title-zone tidy-ups in 09, 10 and 11, the 10 chair edge.

## Where I differ from the DP's notes (read after forming the verdicts above)

- The notes say "For the first 7 s of every chapter the lower-left third holds only floor, plant or dark furniture". With the real titles burned in, 07's title runs into the desk base and the brightest highlight in the frame, and 11's title sits on the high-contrast chair. (The DP probably checked a 640 × 360 lower-left third. The title actually extends to x≈900.)
- 07: the notes don't mention the caster and monitor crop during the lift. 09: the notes present the close C-frame ending as intended, but in the frame it is crushed and cropped. 10: the notes don't mention that the screen image is static. 11: the notes don't mention the chair left in the "empty bay floor".
- The DP chose ease 0.3–0.35, versus 0.04–0.12 on chapters 1–6. That choice causes S1. The notes don't flag it.
- I agree with the DP's own compromises: the 10 chair stays under the 20% cap, 12's desk front is dark, and the 08 desktop-plane pass is fast and blurred. I found no geometry intersection or near-plane clipping in any of 07–12, and no black edges or voids.
- I could not check the 06 → 07 boundary: `renders/05.mkv` and `06.mkv` don't exist yet.

---

# Revision 1 (re-review of the re-rendered 07–12)

Reviewed 2026-10-29 against `renders/07–12.mkv` (rendered 22:41–23:08) and `shots/07–12.json` (22:35). I re-ran the same measurements:
- 0.5 s contact sheets;
- per-frame difference, duplicate, `freezedetect` and step detection (`r1/framediff-NN.txt`);
- camera speed from the baked keys (`r1/camspeed-NN.txt`);
- camera travel in the 1.5 s dissolve windows (`r1/dissolve-window-travel.txt`);
- the real `final/titles.ass` burned in, with the title box x 96–1060 / y 760–990 drawn (`r1/titles-burned-07-09.jpg`, `r1/titles-burned-10-12.jpg`), sampled at 2, 4, 6 and 7.4 s;
- simulated 1.5 s dissolves for 06→07 … 11→12 (`r1/trans-all.jpg`).

All new evidence is in `review/evidence-b/r1/`.

## Verdicts, revision 1

| Ch | Prior | Now | Summary |
|----|-------|-----|---------|
| 07 wellness | FIX | **PASS with notes** | The casters are back in frame, the arc is smooth and the title clears the desk. The monitor's top corner still kisses the frame top (~9 px) at 7.4–8.0 s. |
| 08 awareness | FIX | **PASS with notes** | The crane is smooth now: peak 1.5 m/s, max acceleration 1.6 m/s², no surge. The lower-left is clean during the title. The roll is still only faintly readable because the camera tracks it. |
| 09 music | FIX | **PASS with notes** | The ending reads as a desk, and the speed step is gone. The colour wheel now takes 12 s (saturation is left to the grade). The monitor top and casters are trimmed by the frame edges at the very end. |
| 10 media | FIX | **FIX** | The picture plays, the room responds and the stop/restart is gone. **New:** the in-scene clip is third-party music-video footage with recognisable performers. |
| 11 storage | FIX | **PASS with notes** | The crane builds smoothly (max acceleration 1.5 m/s², no kick) and the head drifts. The chair is still on the "open floor", and a green chair back sits under the title at 1.6–3.0 s. |
| 12 hero | PASS w/ notes | **PASS with notes** | The velocity steps are gone, and the end card and title zone are clean. Exposure is deferred to the grade. |

## Systemic issues: both resolved

- **S1 (static handles): resolved.** Camera travel inside the 1.5 s dissolve windows is now 12–141 cm (it was 1.7–19 cm), at 0.5–6.8° of aim change:
  - 07: 24 / 20 cm (head / tail)
  - 08: 40 / 92 cm
  - 09: 32 / 17 cm
  - 10: 28 / 12 cm
  - 11: 12 / 141 cm
  - 12: 89 / 27 cm, with an ease-out to the end card, which is correct at the end of the film.

  No frame in any chapter falls below the 0.15 diff "frozen" threshold except ch 12 from 12.5 s, which is the allowed end-card settle. `freezedetect` finds nothing, and there are no duplicate frames. All six dissolves now read as one gesture (`r1/trans-all.jpg`). 08→09 (desk over desk) and 11→12 match especially well.
- **S2 (velocity stepping): resolved.** Peak camera acceleration per chapter is now 0.03–1.6 m/s² (it was 3–24). The step detector finds no camera steps in 07, 09 or 12. In 08 the only flag is the deliberate landing at 7.33 s. In 11 the flags are a sub-perceptual 0.3-luma shading flicker at 2.67 s, invisible in playback. In 10 every flag is a cut in the screen clip, not camera motion (see below).

## 07 wellness: PASS with notes

Previous FIX items:
1. **Casters cut off during the lift: resolved.** The lowest caster pixel peaks at y≈980 at 7.6 s, about 100 px of floor below it (`r1/07-full-7.6s.jpg`).
2. **Monitor touching the top: partly resolved.** The monitor's top-right corner sits ~9 px from the frame top at 7.4–8.0 s (`r1/07-monitor-headroom-7.6s.png`). It's a tangent, not a crop. A careful viewer will feel it as cramped headroom at the top of the lift. Suggested fix (optional): FOV 37 → **39.5** on the 7.2 s key. That gives ~30 px of headroom, and the casters keep ~70 px.
3. **Gear change at 7.9 and 8.2 s: resolved.** The aim rate now builds smoothly from 1.8 to 9°/s over 6.5–8.5 s, with peak acceleration 0.54 m/s² and no steps.
4. **Title over the desk base and underglow: resolved.** The title text ends at about x 760, and the caster and glow begin at about x 800 (`r1/titles-burned-07-09.jpg`).

Notes:
- **New:** the exercise bike is now a large element on the left for 0–9 s. Its lime flywheel ring (y ~520–740) is the most saturated thing in the frame and sits just above the title. The bike's dark frame sits behind the title text, so legibility is fine. It's motivated context ("gym"). If the grade can't calm the lime, consider trucking ~0.3 m so the flywheel drops to frame left.
- The sunlit floor patch sits under "your day." at 2–6 s. Legibility depends on the title shadow, so check it in the graded master.
- The final frame is still a square-on elevation (the prior note stands). It's acceptable, and the camera is still drifting into the dissolve.

## 08 awareness: PASS with notes

Previous FIX items:
1. **Whip crane: resolved.** Peak speed is 1.48 m/s and 14.7°/s (it was 4.45 m/s and 31.5°/s), with max acceleration 1.6 m/s² (it was 24). Frame difference rises smoothly to a plateau of 4.3–4.8 at 3.5–5.0 s with no mid-move dip. The 8-frame strip at 4.9 s moves an even ~15–30 px per frame (`r1/08-strip8-4.9s.jpg`).
2. **Monitor cropped at 3.8–4.8 s:** the desk is still cut by the top and right edges while the crane passes behind it (`r1/08-full-4.0s.jpg`). That's acceptable as a passing frame in a moving shot.
3. **Pylon in the title zone: resolved.** The lower-left is dark void and the ring line at 2, 4 and 6 s. The new opening (`r1/08-full-0.4s.jpg`: base and caster right, pylon rising left) is a strong graphic frame.
4. **Roll readability: improved but still subtle (note).** The camera now holds altitude during the roll (0.03–0.06 m/s at 7.5–9.5 s) and is closer (y 6.3). But the target pans 0.18 m with the desk (x 0.018 → 0.20 between the 7.4 s and 9.8 s keys), which cancels most of the 0.25 m of travel. The desk moves ~45–65 px in frame, and mostly the faint grid and pylons slide instead (`r1/08-desk-travel-7.0-vs-9.8s.jpg`). Suggestion: keep the 9.8 s key's target at x 0.02, the same as the 7.4 s key, so the desk visibly travels ~90 px (~8% of frame height) toward the pylon while the frame holds still.

Notes:
- The product is seen mostly from its back (cable panel and monitor back) from 3 to 12 s. That's fine for a sensor beat, but it isn't the hero side.

## 09 music: PASS with notes

Previous FIX items:
1. **Crushed, cropped ending: resolved to a note.** At 13.8 s (`r1/09-full-13.8s.jpg`) the desktop, monitor, keyboard tray, C-frame and arcade all read, and the desk is clearly the subject. Remaining trims: the monitor's top edge is cut (the "Solo exploration" header runs off the top), and the front casters touch the bottom edge. Optional fix: FOV 44 → 47 on the 14 s key, or lift the target y by 0.1.
2. **Speed step at 5.9 s: resolved.** Max acceleration is 0.11 m/s², and the aim rate is a smooth 1.4 → 5.1 → 2.1°/s curve with no frame-diff steps.
3. **Rainbow wash (scene issue): improved.** `ledPeriod` 12 s halves the cycle rate. The room is still uniformly saturated, so the look depends on the grade's saturation trim, as the coordinator says.

Notes:
- Title zone: the planter and the neon rug border sit under the title, and the desk's front-left caster sits near the title's end at 4–7 s. The base hue under the title moves from yellow through green to cyan between 1.6 and 7 s. Text stays legible over these hues, so this is a note.

## 10 media: FIX

Previous FIX items:
1. **Frozen picture and no spill: resolved.** The clip plays (`r1/10-contact-0.5s.jpg`). The room visibly responds: the wall and floor brightness and tint shift with the picture.
2. **Stop and restart at 9.4–10.2 s: resolved.** Camera speed stays at 0.11–0.19 m/s for the whole chapter (minimum 0.113 m/s at 10.5 s). There is no duplicate frame and no frozen run.
3. Chair at 3.5–7 s: 14–17% of frame (proxy). It is under the cap, so the note stands.

**New FIX: rights and likeness of the screen content.**
- What's wrong: the in-scene clip (`app-reference/assets/desk_viewer/media/ambient-clip.mp4`, 40 s in) shows recognisable third-party music-video footage (`r1/10-screen-content.jpg`, `r1/10-full-4.5s.jpg`, `r1/10-full-12.0s.jpg`):
  - at 0.5–1.1 s, a close-up of a female performer's face;
  - at 2.5–6 s, a dancer in a white suit, blue shirt and white fedora in a 1930s club set. It reads as Michael Jackson's "Smooth Criminal" or a close imitation;
  - then ensemble and jukebox shots.
- Why it matters: at FOV 31–36 the screen fills 15–40% of frame, and from 9 s it's the focal point under "Movie night, upgraded." In a commercial product film that ships in the app and on the website, recognisable performers and copyrighted footage are a licensing and right-of-publicity problem. Viewers will also recognise it, which takes their attention off the desk.
- Fix: re-render ch 10 with an owned clip. `render-cut.cjs` already supports this: `--screen exports/cinematic-intro-20261030/post/screen-film.mp4`. That's the 20 s sunset film, and its warm-to-violet colour sweep would show off the ambient-colour feature better than the dark club footage. Set `screenOffset` so the sunset's colour change lands in 9–14 s. If a "movie" look is wanted, use licensed stock or generated footage with no recognisable people. I'd also flag that the same clip ships in the app's media viewer (`main.dart.js` references `media/ambient-clip.mp4`), so the rights question applies there too.

**Note (recommended): ambient light pumps at every cut.** The room's overall brightness jumps by up to ~20% in 1–2 frames at the clip's cuts:
- 5.03 → 5.23 s: mean luma 67 → 84;
- 5.83 → 6.03 s: 80 → 64;
- the left third of the frame (wall and window, no screen) changes by 14–17 luma at 5.90–5.97 s (`r1/10-strip8-5.83s.jpg`).

Most of this happens under the title (1.6–7.2 s). It reads as the room lights flickering more than as a premium ambient wash. If the stage's ambient sampler has a smoothing constant, a ~0.3–0.5 s low-pass would fix it. The sunset clip suggested above has no hard cuts, so it would avoid this too.

Flow: the tail now pushes in at speed (12 cm / 1.5 s) into ch 11's drifting head, and the dissolve reads as one move.

## 11 storage: PASS with notes

Previous FIX items:
1. **Crane kick at 11.0 s: resolved.** The rise builds from 0.06 to 0.81 m/s over 10.0–13.5 s with max acceleration 1.5 m/s² (it was 9.9), and the aim rate stays at a steady 6–7°/s. No frame-diff steps.
2. **Locked-off opening: resolved.** The camera drifts at 0.07–0.11 m/s from frame 0, and the frame diff at 0–1.5 s is 0.57–0.9 (it was 0.04–0.15).
3. **The "open floor" payoff still has the task chair on the mat: note, lead decision.** At 16.8 s (`r1/11-full-16.8s.jpg`) the chair sits left of centre on the mat, with the parked desk upper right. It's now framed as a deliberate counterweight, not dead centre, and reads naturally. It's still not literally "the floor is yours". Fixing it means moving the chair in the scene.
4. Edge clutter at the end: the right-edge commons chair is now small (~3%). **New:** the "ERGOFLEX / PILOT CONCEPT" floor decal is cut by the bottom edge in the last ~1.5 s, but that is inside the dissolve to 12. Note only.

Notes:
- **New:** a green commons chair back sits as hard-edged foreground in the lower-left corner (x 0–270, y 740–1080) for 0–3.0 s (`r1/11-full-2.0s.jpg`). It sits under "Make room for what's next." from 1.6 to 3.0 s. Legibility is fine (dark wood and green), but it's busier than the brief's "calm lower-left". It's also the first thing seen through the 10→11 dissolve. Optional fix: start ~0.25 m further screen-right, toward +x, so it clears frame left by 1.5 s.
- The task chair still sits under the title's tail at 2–7 s. Dark, legible; note only.

## 12 hero: PASS with notes

- **Two-step deceleration at 8.85 and 9.10 s: resolved.** No steps, max acceleration 0.55 m/s² (only in the final ease-out), and a smooth 0.58 → 0.92 → 0.07 m/s profile.
- **Title zone:** clean. The thin pulse-ring line passes behind "Reimagined." at 2 s (note).
- **End card:** the desk is in the upper middle and the lower half is near-black from ~9 s. Near-static from ~12.5 s, which is allowed.
- Notes carried over: exposure is left to the grade (desk body luma ~10–30 on a void of ~9). The move is still mostly a pull-back (~17° of arc).

## Remaining FIX list (revision 1)

1. **10 media: replace the screen clip.** The in-scene media is third-party music-video footage with recognisable performers (white-suit/fedora dancer at 2.5–6 s, close-up face at 0.5–1.1 s, ensemble at 6–13 s). Re-render with `--screen exports/cinematic-intro-20261030/post/screen-film.mp4` (or another owned or licensed, people-free clip). Set `screenOffset` so the colour change peaks during the 9–14 s hold. That also removes the cut-driven ambient pumping. Separately, flag the clip's rights for the app itself.

Optional polish, not blocking: 07 FOV 39.5 at the 7.2 s key (monitor headroom); 08 lock the target during the roll (7.4–9.8 s); 09 FOV 47 at 14 s; 11 start ~0.25 m further toward +x (foreground chair under the title); a smoothing constant on ch 10's ambient sampler.
