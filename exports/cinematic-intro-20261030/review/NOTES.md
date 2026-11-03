
## Chapters 07–12 (DP-B)

Shared conventions: every move is one continuous `cameraPlan` → `camera-spline.mjs` path (ease 0.3–0.35), rendered `--video --blur 4 --ss 1.5`. Camera keys were checked against probed room bounds (walls, the hidden ceiling, furniture boxes). All interiors look only toward each room's built walls, so the open dollhouse sides never show. For the first 7 s of every chapter the lower-left third holds only floor, plant or dark furniture.

### 07 wellness (gym): 15.0 s
- Lift `stand-break` retimed to start 3.0 s, duration 5.0 s, smooth (was 6.0/6.0, so 1.2× faster), 28″→43.5″.
- Move: seated-eye 3/4 from the strength side with window light at frame left (desk centre-right). Slow push, then pedestal up with the lift (camera 1.20→1.60 m), then a slow arc and pull-back to a frontal standing portrait with the MOBILITY board and weight rack.
- Final move: arc left and pull back (camera travels +z / out), landing frontal.
- Compromises: a thin sliver of the training bike sits on the left frame edge for 0–2 s. It's dark and under 3% of the frame.

### 08 awareness (product void): 12.0 s
- Wheels clip retimed to start 6.0 s, duration 3.5 s (was 9.84/3.66). Pylons rise over 0–2.4 s (fixed by the stage).
- Move: low, telephoto (FOV 26) on the base with the pulse ring and the first pylon rising, then one continuous crane up and over (FOV 28→30) into a near-vertical, axis-aligned top-down. Slow descent (10→7.9 m) while the desk rolls toward the bottom of frame inside the sweep ring.
- Final move: slow vertical push down on the top-down, desk moving down-frame.
- Compromises: the crane passes through the desktop plane around 3.2–4.0 s, so the desk is very large in frame for about 0.8 s. It's the subject, not an occluder, and it's motion-blurred.

### 09 music (gaming room, night): 14.0 s
- No desk clips. Move: high-corner push in over the sofa toward the glowing desk, then a descending low lateral that clears the sofa and ends low on the desk's LED-edged C-frame side, with the arcade and console wall behind.
- Final move: descend and truck left (camera −x), low.
- Reactive light: the bake used to hold solid red until the chapter clock passed the page uptime (`ledEffectStart` is performance.now() at prepare). render-cut.cjs now re-arms the spectrum effect after prepare for music shots, so the hue cycles from frame 0 (6 s per full wheel). Verified in renders/09.mkv: red→yellow→green→cyan→blue→violet→magenta within the chapter.
- Compromises: the gamer chair sits lower-right in the opening wide (dark, under 15%) and is a soft right-edge sliver at the end.

### 10 media (home office, night): 14.0 s
- No desk clips. Lamp occlusion is gone: the camera runs only on the entry-wall side (z ≈ 1.4–2.15), looking −x/−z, so the bronze reading lamp is always behind the lens.
- Move: elevated 3/4 from over the armchair, dollying in beside the chair (chair passes out of frame right by about 7 s). It lands on the curved screen at 9.6 s (FOV 40→31), rests 0.4 s, then a slow push to FOV 30 holds the picture, the desk and the lamp-lit wall to the end.
- Final move: push in, drifting screen-left, settling.
- Compromises: the chair crosses frame right at 3.5–6.5 s, peaking around 15–18% of the frame (under the 20% cap).

### 11 storage (library): 17.0 s
- Desk performance changed (deviation). The desk already starts against the tackboard wall, and the old 3″ wheel clip hit the wall and was invisible. Tilt retimed to start 1.5 s, duration 5.0 s (×1.38) to 65°. It's followed by a new wheels clip `storage-roll`: start 6.6 s, duration 6.4 s, smooth, 55″ (1.4 m) sideways along the wall (desk-local +z = world +x), clear of its chair, to park in the open wall space beside the green pilot bay. Max speed is about 0.33 m/s.
- Move: human-height (1.75 m) 3/4 of the working desk with its chair. It tracks the tilt with a slow push, then pans and trucks right with the roll. From 12 s it rises to 5.3 m (wall height 10.9 m, so no ceiling or wedge) and pulls back over the commons table to reveal the empty bay floor, the "ERGOFLEX / PILOT CONCEPT" mat and the parked, tilted desk.
- Final move: crane up and pull back (camera +y, +z).
- Compromises: the corner of a white commons table and chair backs sit soft at the bottom-right edge from 13 s on (under 8%). The red wheelchair prop is visible, small, at the left edge in the opening.

### 12 hero (product void): 14.0 s
- No desk clips. Move: slow telephoto orbit (FOV 26, 44°→26° around the desk, camera about 2 m high, desk right of centre for the title). It flows into a descending push-out (R 9→13 m, camera 2.05→0.40 m) that re-centres the desk in the upper-middle third. The last ~2 s are almost static.
- End card: from about 8.5 s the desk base sits at or above frame centre. The lower half is near-black void with only a thin, faint floor-grid band just under the desk (no pulse ring after about 8 s).
- Final move: pull out and crane down, settling to near-static.
- Compromises: the scene's product lighting leaves the desk front fairly dark. The desk reads by its red rim LEDs and white side panels.

### Scene / tool issues found (not fixed in app code)
- The LED spectrum bake clock (see 09) is an app bug. It's worked around in render-cut.cjs for music shots.
- The live-server on :3000 reloaded the stage on any write under exports/. render-cut now uses a private static server on :3017.

## Chapters 1–6 (DP A)

Workflow notes: every camera is a single continuous `cameraPlan` spline (ease 0.04–0.12). Positions were checked against room geometry probed from the live stage (wall planes, ceiling height, prop bounding boxes). The camera stays inside each room's walls and below its wall tops, with at least ~0.45 world units (≈0.3 m) of clearance from furniture. Desk-motion retimes are all ≤1.4× the 10-29 speed. Each final render is `--video --blur 4 --ss 1.5`.

Tooling caveat: in room chapters where the desk drives (ch 4), `--at` stills with large time gaps can show the desk lagging behind, because the stage's collision-checked glide refuses big jumps. Dense `--stills N` sheets and the video are correct.

### 01 awaken — 34.0 s (locked)
- Desk: roll-in 1.4–4.0 s (2.6 s, slower than 10-29). Rise to 41″, strafe and 45° turn at 8.0–11.9 s. Lift to 45.5″ and tilt to 8° at 12.4–15.2 s. Full lift to 52.5″ with the turn back and the tilt reset at 23.0–26.6 s.
- Camera: extreme low macro (FOV 24) on the front-left omni wheel, pushing across it. The desk rolls toward the lens and the camera cranes back to the full silhouette by ~6.5 s (title A; desk in the right third, lower-left is dark floor). A long arc follows the rise, strafe and turn, then descends to a low-angle 3/4 hero for the lift and tilt (~15 s). It settles into a right-third 3/4 portrait for title B (16–23 s, slow drift). It drops low again for the full lift and turn-back (23–27 s) and ends on a slow push-in.
- Final move: slow push-in, drifting screen-left (camera orbiting toward +z), FOV 28.
- Deviation: the treatment orders "low hero on full lift + tilt → portrait for title B". The 10-29 performance has three lift stages, and putting all of them before 16 s would leave 18 s of dead desk. So the 45.5″ lift and tilt get the low hero before title B, and the final 52.5″ lift plays after title B with its own low-angle hero, followed by the push-in.
- Title-safe: lower-left is calm 0–7 s (dark void and floor grid; the blue pulse ring crosses the lower frame for the first ~1.5 s). Title B window: the desk is in the right third and the lower-left is dark floor.

### 02 rise — 16.0 s (locked)
- Desk: 28→43.5″ at 1.6–6.4 s, 43.5→52.5″ at 7.4–10.6 s (smooth, 1.25×).
- Camera: seated eye level, close (FOV 32), with the task-chair back as a soft dark edge on screen-right (~10%). It pedestals up at exactly the lift's rate (0.594 then 0.345 world units), so the desk holds still in frame while the room drops away. Then it descends and widens (FOV 46) to a lower 3/4 at full height with the window behind, finishing on a slow push-in.
- Final move: push-in, slight drift screen-left.
- Compromises: the open +x side and the armchair limit how far back the camera can go. The "low" 3/4 sits at y 1.5 (seated-eye height, well below the 52.5″ surface) because the camera must clear the armchair by 0.45. The ficus in the window corner sits at the left frame edge (low-contrast foliage and pot) during the title window.

### 03 create — 18.0 s (locked)
- Desk: tilt to 25° at 1.4–5.2 s, tilt to 65° at 7.6–12.6 s (smooth, ≤1.3×).
- Camera: high top shot over the drafting surface from the user side (y 4.0, under the 4.53 wall top, FOV 50) as it tilts to 25°. It cranes down and arcs to a side profile from the materials-wall side as the surface rises to 65°, then lands on the easel portrait: the window wall and studio on the left, the tilted surface filling the right half. Slow push-in.
- Final move: push-in, drifting screen-left.
- Compromises: true overhead is impossible under a 4.53 ceiling with this desk's monitor arms, so the top shot is a steep (~60°) high angle. The desk is large for this room. The side profile and the easel portrait are medium shots that crop the base, because backing off further would put the camera inside the cabinet or the far wall.

### 04 commons — 14.0 s (locked)
- Desk: the drive from the green study bay was 11.8 s and is now 8.6 s (1.2→9.8 s, 1.38×). The final quarter-turn into place is 9.8–12.2 s.
- Camera: starts inside the commons at table height (y 1.45) with no exterior establishing shot. It tracks alongside as the desk rolls, rising over the study tables (chair backs slide through the lower frame), overtakes the desk, and lands from the café side on a group composition: the project table in the foreground, the Humboldt desk docked beside it, and the power wheelchair at frame right.
- Final move: gentle push-in toward screen-left (camera travelling -x).
- Compromises: there are no people in the commons, so "group" means the desk joining the shared table and the accessible station. A dark architectural column touches the right frame edge (<8%) in the last 3 s.

### 05 coast — 11.0 s (locked; no desk motion in this chapter)
- Camera: lateral dolly at y ≈2.3–2.45 (≈1.5 m) down the column of media stations: the audio station, then the film-editing station with the big "Portfolio / Review" display behind it, ending on the hero ErgoFlex station.
- Final move: lateral slide (camera travelling +z) settling into a slight push toward the hero station.
- Deviations: the green screen is in the capture stage at the opposite (+x) end of the lab from the hero station, behind the camera. A path that passes it and lands on the hero must either thread past several desks at under 0.4 m or show a full-frame flat green slab, so it is omitted. The big display is passed instead. The frame is kept pitched down so the open ceiling above the far wall top never shows.
- Compromise: the film-editing station's task chair crosses frame right at ~15% coverage for ~1.5 s.

### 06 oilers — 11.0 s (locked; no desk motion)
- Camera: starts just below the top of a front-row student table, looking past it to the ErgoFlex station by the window. It rises over the table (the tabletop sweeps down out of frame by ~3 s) to reveal the classroom, then pushes gently toward the station (y 2.35–2.5, under the 4.9 wall top).
- Final move: push-in toward screen-left.
- Compromises: the student table (white top, red bottle, orange book) is the motivated foreground in the lower frame for the first ~4 s, so the lower-left during the title is busier than ideal. The station's own task chair and the grey designer chair stand in front of the desk (lower frame) at the end. The upright of a neighbouring ErgoFlex desk is a thin dark sliver at the left frame edge (~5%) for the first ~5 s, and a dark chair seat clips the lower-left corner during the first ~0.6 s (inside the handle).

## Chapters 07–12, revision 1 (DP-B, after REVIEW-B)

All six chapters were re-splined with the new camera-spline timing (no `samples`, about 15 keys/s, monotone speed) and re-rendered (`--video --blur 4 --ss 1.5`). Review sheets are refreshed. Durations are unchanged: 07 15 s, 08 12 s, 09 14 s, 10 14 s, 11 17 s, 12 14 s.

- **S1 handles:** `easeIn:false, easeOut:false` on 07–11, and `easeIn:false` with easeOut kept on 12. Camera travel in the first/last 1.5 s:
  - 07: 24 / 20 cm
  - 08: 40 / 92 cm
  - 09: 32 / 17 cm
  - 10: 28 / 12 cm (plus a slow zoom to FOV 31)
  - 11: 12 cm plus a 4° pan / 141 cm
  - 12: 89 cm / settles.
- **S2 speed steps:** neighbouring segment speeds now differ by at most 1.2× everywhere except 08's landing into the roll hold. Peaks:
  - 07: 0.41 m/s, 9°/s
  - 08: 1.5 m/s, 14.8°/s (was 4.5 m/s, 33°/s)
  - 09: 0.27 m/s
  - 10: 0.19 m/s
  - 11: 0.99 m/s
  - 12: 0.92 m/s.
- **Title zone (x 96–1060, y 760–990, 1.6–7.5 s):** checked on every iteration with the box drawn on the stills.

Per chapter:
- **07:** Opening panned 12–13° so the desk sits in the right ~45% through the lift. The title box now holds only floor, the sun patch and the bike's dark base rail. The bike wheel edge enters the box top at 6.5–7.5 s. Distance is held through the lift, so the casters and monitor stay in frame from 6 to 9 s. The arc starts at 7.2 s with mid keys at 9.8 and 12.4 s and ends ~13° short of square. Final move: arc left, pull back.
- **08:**
  - Rebuilt from the desk's rear quarter: a low base push (0–1.5 s), then a crane plus 25° quarter orbit from 1.5 to 7.4 s, landing on a symmetric ~59° oblique, then a slow rise to ~70° pitch from 9.8 to 12 s.
  - Altitude is held 7.4–9.8 s while the wheels clip runs (retimed to start 7.0 s, 2.8 s long, 1.3×). The desk travels up-frame against the grid.
  - Pylons land in the upper corners. The title box holds only the faint pulse rings and grid. A pylon rises mid-left above the box at 0.8–3 s.
  - Final move: rise and push down toward top-down.
- **09:**
  - `ledPeriod: 12`, so the colour drifts over about 12 s per wheel. The opening is panned 10° (desk right). Keys at 0 / 4.5 / 9.0 / 14 s.
  - The end is wider: (0.72, 1.40, 2.60) → (−0.95, 1.0, −0.05) at FOV 44, with the whole desk from monitor to casters in frame.
  - The reviewer's suggested z 2.95 is outside the floor's open edge (z 2.72), so I kept z 2.6.
  - At camera height ~1.2–1.3 near the sofa back (y 1.29) the sofa top shows as an edge-on wedge, so the end stays at y 1.4.
  - Final move: descend, truck left.
- **10:**
  - `screenOffset: 40`. The clip plays 40–54 s: white suit, red/teal, smoky blue club, warm close-ups, then the jukebox through the hold. The picture is verified as playing in renders/10.mkv. The 0.4 s hold is gone, so the push runs through 9.6 s.
  - The final hold slowly zooms to FOV 31, with headroom kept above the monitor.
  - The opening is tilted up slightly, so less rug sits under the title. The planter stays as a dark element under the title.
  - Final move: push in, settling.
- **11:**
  - Keys at 0 / 6 / 11 / 13.5 / 17 s, so the rise builds smoothly (ratio 1.2 at 11 s). The opening is panned 15°, putting the task chair mostly right of x≈900. Its star base still touches the box's right end at 2–7 s. A soft foreground commons chair-back sits at the left edge for 0–3 s as parallax.
  - Final frame: camera at (−2.25, 5.4, −5.6), FOV 37. The task chair sits on the left third of the mat and the parked desk on the right. The table corner is gone. A sliver of chair back remains at the bottom-right corner.
  - Final move: crane up and pull back.
- **12:** Orbit 52°→25° over 0–6.8 s, then push-out. The 9.8 s key moved to 10.6 s, so the push-out decelerates in one smooth ramp. The lower half is clean from ~9 s, with the desk base at about frame centre by 8.5 s. Final move: pull out and crane down, settling (easeOut).

## Chapters 1–6, revision 1 (DP A, after REVIEW-A)

All six plans now use the new spline timing: `samples` and `ease` are removed, keys land at exactly their `at` time, and speed changes smoothly. Chapter 1 is `easeIn:true, easeOut:false` (it opens from black). Chapters 2–6 are `easeIn:false, easeOut:false`. Every chapter's last segment carries at least 0.17 u/s (some end segments got a midpoint key to stop the cubic decelerating into the tail). Measured from `camera.keys`, in u/s, head → tail-handle:
ch1 0.03 (from black) → 0.40 · ch2 0.18 → 0.18 · ch3 0.12 → 0.16 · ch4 0.26 → 0.54 · ch5 0.49 → 0.32 · ch6 0.58 → 0.20.
Durations are unchanged: 34 / 16 / 18 / 14 / 11 / 11 s. All six were re-rendered with `--video --blur 4 --ss 1.5`, and the sheets were refreshed.

### 01 awaken
- **Pendulum removed.** The azimuth around the desk now runs +24° (6.9 s) → −30° (11.6 s) → −72° low hero (15.2 s), then a crane up of 1.6 u at almost the same azimuth to −80° (19.0 s, portrait for title B). The only reversal happens inside the title-B drift (−80° → −69°, ~0.37 u/s from 19 to 22.6 s). After that the camera follows the desk's turn back to the full-lift low hero at −20° (28.4 s). Peak speed is now 2.3 u/s (during the 9–12 s arc that follows the strafe and turn), not under title B. Title B (16–22.5 s) is 0.4–0.7 u/s of drift.
- **The 3.37 s hitch is gone.** The aim now tilts up steadily from 1.4 s (2.7 s key target y 0.26, 4.0 s key 0.45), the old tool's staircase sampling is gone, and the pull-out has no braking step at 7.8 s.
- **Full lift retimed 2 s later.** Lift at 25.0 s, turn at 25.35 s, tilt resets at 27.1 / 28.3 s. Desk action ends at 28.55 s.
- **The tail pushes in.** The camera goes from distance 7.8 to 6.25 u, FOV 28 → 26, rising to y 1.3 so the lit desktop edge reads, at a constant ~0.40 u/s through the handoff. The final frame crops the base slightly and keeps headroom above the monitor.
- **Title zones.** The silhouette at 6.9 s moved up in frame (casters clear the bottom). The 0 s and 1.4 s aims tilt up, which keeps the pulse ring lower. The title box (x 96–1060, y 760–990) stays dark throughout, with a mean luma of 15–34 out of 255.
- **Final move:** a push-in drifting screen-left with a slight crane up.

### 02 rise
- **The head moves.** The camera starts 0.27 u further back, (3.32, 1.48, 1.7), and moves at 0.18 u/s from frame 0. The opening pans so the ficus pot sits further off the left edge.
- **Softer crane-down.** It is now 10.6 → 12.3 → 13.8 s instead of landing at 13.2 s. The tail ends with a 0.2 u/s push, and a midpoint key at 14.9 s holds the speed.
- **New fix: open-ceiling void at the top.** While checking, I found black void showing at the top-right of the frame around 10.6–11.2 s, above the walls. The ceiling is disabled in presentation, so the camera at y 2.48 with FOV 36 was seeing past the wall top. The high pedestal keys now aim lower and the low 3/4 uses FOV 44 instead of 46. Confirmed clean on stills from 10.6 to 16 s.
- **Unresolved: the title zone is still bright.** Mean luma is 126–139 over 0–7.5 s. This is a daylit room, and the lower-left third is the pale window-wall cabinetry under the window. The two alternatives I tried were worse. A dark chair-back foreground in the lower left (from the −z side) covers more than 20% of the frame and occludes the desk. Panning so the desk's keyboard tray fills the box only brings the luma down to ~110. **Ch 2 needs a scrim or grade under the title.**
- **Unresolved: monitor glare.** The pendant light's reflection on the portrait monitor (9.5–16 s) stays when the low-3/4 keys move 0.2 u laterally, so it is left for the grade.

### 03 create
- **No more 2.97 s prop pop.** `motion.initial.tilt` is now 12, so the desk starts stowed, and the drafting clip runs 12 → 25° over 1.4–4.4 s. Stills confirm the desktop is already clear at frame 0. The opening aim is trimmed about 3° to screen-right.
- **65° payoff.** The 10.6, 14 and 18 s keys swing about 25° around toward the desk's −z end, drop to y 1.75 → 1.55, and use FOV 48. The 65° board now reads in profile against the window wall, and the frame pitches slightly down, so the open ceiling never shows. An earlier pass at y 1.5 aimed up at the board showed a black void strip above the wall top. The very end (~17.5–18 s) gets closer to the desk's end panel, which fills the right third.
- **Mug pop (10.53 s).** The stow shelf at the easel transition sits behind the monitors and the board from this angle. I couldn't confirm it on stills: sparse `--at` stills in this chapter seem to return stale frames, so it is to be checked in the mkv. **App note:** stowed shelf items should not vanish at the 50° easel transition.
- **Unresolved: clipped white desktop.** The coordinator will grade it down.
- **Final move:** a lateral slide toward the desk's end (screen-left), descending slightly.

### 04 commons
- Handles move (0.26 → 0.54 u/s). The opening aim tilts up about 2°, so the floor-seam diagonal leaves the title box (mean luma 62–85).
- **New ending.** The camera pushes about 0.6 u closer at FOV 42, with the desk on the left-third line (12.6 → 14 s). The red power wheelchair is cropped to its seat-back in the lower right, and the Humboldt desk is the clear subject.
- **Final move:** a push-in toward the desk, drifting screen-right.

### 05 coast
- Handles move (0.49 → 0.32 u/s). The whole dolly is 0.15–0.25 u lower (y 2.2 → 1.95) and starts 0.3 u further along +z. The void check is still clean with the pitch held down.
- **End re-aimed.** The hero station's casters now sit about 60 px clear of the frame bottom.
- **Unresolved:** the film-editing station's task chair still crosses frame right (about 15% at peak for about 1.5 s).
- **Final move:** a lateral slide along +z, settling into the push.

### 06 oilers
- **Faster rise.** It reaches y 2.2 by 2.2 s, and the tabletop is under 20% of frame by about 1.9 s.
- **Earlier push.** The 7 s key moved to 5.0 s with +0.5 u of push, plus an 8 s key, so the end segment moves at 0.2 u/s. The red bottle, notebook and table corner leave the title box by about 4.3 s.
- **Opening shifted.** It moved 0.1 u to screen-right, so the neighbouring desk's upright is a thin edge sliver until about 2.4 s.
- **Remaining:** after 5 s, the station's own dark task chair sits over light floor in the title box (mean luma ~90, std ~78). It's part of the hero station, so I left it.
- **Final move:** a push-in toward the station, drifting screen-left.

## Chapters 07–12, polish pass (DP-B)
Re-rendered only 07, 08, 09 and 11. Durations unchanged. 10 and 12 untouched.
- 07: the 7.2 s key widened from FOV 37 to 39.5 for monitor headroom at 7.4–8.0 s.
- 08: target held at x 0.02 on the 7.4 s and 9.8 s keys, so the desk visibly travels up-frame toward the pylons during the roll. FOV is 31 on those keys and 30 at the end, to keep monitor headroom.
- 09: end key widened from FOV 44 to 47, and the end aim raised (target y 1.0 to 1.14), so the monitor top has headroom and the casters stay in frame.
- 11: the suggested +0.25 m in x would put the camera inside a commons chair at x 0.36–1.11. Instead the opening moved to (0.12, 1.58, −7.25), between the chairs. That puts the green chair back behind the camera. Only a thin dark sliver remains at the left edge for 0–1 s, and it's clear before the title at 1.6 s. Keys 2 and 3 follow, at (−0.08, 1.79, −7.7) and (0.06, 1.86, −7.85). Head travel is 11 cm plus a pan.

## Chapter 12, revision 2 (DP-B, EXPERT-GUIDANCE #1): stills only, video by the lead
- **Camera:** the expert's positions, used as given. They sit at azimuth 62° → 50° → 38° → 34° → 33.4° around the desk, at R 9.4 → 12.5. The move now ends on a 3/4 (~33°) instead of nearly frontal.
  - The targets keep my earlier sideways offsets, recomputed for the new azimuths, and those offsets are widened slightly (−1.6 / −1.55 / −0.85 m at 0 / 3.5 / 6.8 s). That keeps the desk right of the title box (x 96–1060, y 760–990, 1.6–7.5 s); only the fading pulse ring crosses the box.
  - FOV is 26 throughout. easeIn is false and easeOut is true. Peak speed is 0.79 m/s and 3.6°/s.
- **End card:** from 8.5 s the desk base sits at y ≈ 640–680 px (about 600 px from 11 s on), above the 700 px line, and the lower ~40% is clean void. The monitor and upright tops keep ≥ 10% headroom throughout.
- **Void fields:**
  - `lights: [{preset: productRig, scale: 1}]`.
  - Wheel sceneEdits: charcoal clearcoat rollers and an anodised hub.
  - The grid fades 0.35 → 0 and the pulse 1 → 0 by 8.5 s (grid radialFade [3, 8]).
  - `_screensPlaceholder` holds the main-landscape → screens/12-landscape.mp4 entry. Move it into `screens` once the clip exists.
- **Stills:** review/12-sheet-r2.jpg, and review/12-sheet-r2-guides.jpg with the title box and a red 700 px line drawn on. Rendered with `--storage post/college-seed.json` under `film-gpu.lock`.

## Ch 2 and ch 3, round 3 (DP A: harness fields, expert #2 and #7)
Stills only, no mkv renders. Sheets: `review/round3-dpA/02-sheet.jpg`, `03-sheet.jpg`. Frames: `02-stills/`, `03-stills/`.

**02 rise (16 s; lift clips unchanged)**
- New fields: `accessories` (tablet-pc), `screens`, `clock` 08:00→17:30, `timeOfDay` morning→afternoon→evening, and the `@window` brightness 2.75 / mapBlur 1.5 boost.
- Screens: tablet → `02-tablet.mp4` (fallback; `02-tablet-app.mp4` doesn't exist yet), `main-landscape` → `02-curved.mp4`, `main-portrait` → `02-portrait.mp4`.
- Opening: close on the tablet (FOV 34, tablet right of centre), pushing in through the Stand tap at about 1.0 s. From 1.6 s the camera pulls and cranes out as the desk rises.
- The lift now reads: the camera rises at about 55% of the desk's rate (expert #2 values), so the desktop climbs about 15% of frame height between 5.5 and 10.5 s.
- The end is a low 3/4 at FOV 46→45, floor to monitor top, with wheels visible and a slow push. The void check is clean.
- Title box luma: about 113–161 during 1.6–7.4 s (pale window cabinetry; the window boost doesn't change it much). It is still above "dark-ish" and needs a scrim or grade.

**03 create (18 s)**
- Prop-pop fix kept (initial tilt 12°).
- New ending: the camera crosses the desk's −z end edge-on at 10.8 s, where the board turns edge-on to camera, then lands on a front 3/4 from the user side, with a push to FOV 36 over 14.5→18 s (expert #7).
- The task chair is moved with sceneEdits (+0.35, 0, +0.95 m, turned 30°), as if pushed aside to paint.
- A painted canvas on a table easel (`atelier-artist-table-easel-oak`, scale 140, desk-local z −120) sits on the 65° board.
  - The app's auto-stow hides canvas/easel props below 50° and shows them at 50°. It switches on at about 10.5 s, while the camera sees the board edge-on, so it reads as a few easel sticks appearing.
- Screens: `03-landscape.mp4` and `03-portrait.mp4`. Window boost added too, per #9.
- The 25° sketch sheet is not done.
  - Every library prop on the desktop is stowed above 9° unless its id matches the architect drafting kit.
  - The catalog `drafting-kit` / `artist-easel` / `easel-rail` added through `accessories` don't render. The harness toggles them in the applyPreset hook, and they're gone after the stage's room install.
  - Toggling them after `prepare` does make the objects (checked with a probe). This is a harness fix.
- **Update (ch 3):** with tech's harness fix, `accessories.add` now also includes catalog `drafting-kit`. Its floor-plan sheet, ruler and pencils read clearly on the 12→25° board for 0–10 s (top shot and crane).
  - The app's stow hides the kit at the 50° easel transition (~10.5 s), and the canvas easel appears at the same moment. The camera is passing the desk's −z end edge-on then, so the swap is hidden.
  - The canvas is clearly readable, centre-left, through the 14.5–18 s front-3/4 ending, in front of and below the monitors.
  - Sheet: `review/round3-dpA/03-sheet.jpg`.
