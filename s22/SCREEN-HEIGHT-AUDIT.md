# ErgoFlex film: screen height audit (S22, read-only)

Code base: worktree `C:\work\ergoflex-cine-s22`, branch `cine/s22` at 320530d4. Cut data: `video/cinematic-intro-hq` at
**581ab498** (integration-3: the cut changed in wellness, oilers and finale). `review-cut.json` and `edl.json` were read with
`git show 581ab498:…`. The rig JSONs used are the same at both commits (kai.json changed only outside `wheel-type-31`).
Nothing in the repo was changed. Scratch scripts are in `C:\work\cine-pics\s22\`: `glb.py`, `propbounds.py`, `surf.py`,
`decode.mjs`, `eyes.py`, `screen_audit.py` (writes `screen_audit.json`) and `candidates.py`.

Trigger: Chingon on Yara in the library (commons, 1:24–1:28): she leans in from the hips, shoulders rounded, head tipped
down to a screen whose top is at her chin. The proposed fix was to raise the screen on its arm.

## Headline (read this first)

1. **Nobody in the cut looks down at a screen that is too low.** Every screen top is at or above the user's eye. At
   the desks in this audit the opposite happens: shorter people sit or stand with the screen top 5 to 17 cm above
   their eyes. Their gaze to the screen centre is 3 to 7° below horizontal, under the 15 to 20° ideal.
2. **Yara's hunch is built into the posture, not caused by the screen.** She is cast as `people-yara-stand-mid`.
   cast.py's `stand-mid` is "leaning in over the work": `pelvis_pitch 3, spine (3,4,3), neck 8, head 6`, against
   stand-type's `spine (2,3,3), neck 5, head 4`. By FK, compared with her upright `stand-type`, stand-mid tips her head
   10° further down (24° vs 14°), bends her neck 8° more (40° vs 32°) and leans her trunk 8° vs 3°. Her eye ends up
   2 cm lower and 5 cm further forward. Her screen top is **46 mm above her eye** and its centre is **12.7° below
   horizontal**, inside the guideline. Raising the screen would make the mismatch worse: her head would still point
   down while the screen moved up.
3. **Ava standing in coast (1:44–1:51) uses the same `stand-mid` posture** (head 23°, neck 42°), so it reads the same
   way. It is the second hunching shot.
4. The cheapest fix for the look is a posture swap: an upright `stand-type` built at 39 in for Yara and Ava. Then one
   number per chapter **lowers** their screens a little (`deskObjects` p.y). Screen-only fixes are worth doing for the
   featured desks in coast (Ava) and oilers (Kai), where the screen is 10 to 15 cm too high.

## Method

- **Eye position.** FK on `assets/props/people-rigs/<who>.json` reuses `fk()` from `audit/fk_elbow.py` (matches the GLB
  node chain to 0.1 mm). It is combined with the eye centre measured in the head bone's frame. That offset is the centroid
  of the MakeHuman `low-poly` eye proxy, mapped through the head joint's inverse bind matrix of a posture GLB decoded with
  meshoptimizer. It is about 3 cm up the head bone and 7.5 to 9 cm forward, per character. Head pitch is the head's
  forward axis below horizontal. The character's `stand-wait` gives the neutral reference (rig rest about 16 to 19°).
- **Desk and shelf height.** From `assets/model/desk-public.glb`, at studio.js's mm scale (1 desk inch of lift =
  25.4 mm). The desktop working surface (largest upward face of `Desktop_3`, at its centre) is 678 mm at 28 in. The upper
  shelf `Top_Shelf_4` (the `shelf` accessory mount, which lifts but does not tilt) is 890 mm at 28 in. Both add
  25.4 mm per inch. The shelf mount centre is 276 mm behind the desktop centre. Desk tilt does not move the screen.
- **Screen.** Displays sit on the shelf mount at the build's transform `p = (x, y, z)` in mm (`role: 'shelf'`). On an
  arm, the panel's own stand is hidden and the panel sits at prop y 0 (`workspace-3d.mjs layout()`). Glass bounds are
  read from the props' `monitor-screen` mesh: wide (AETHER 34UW, curved) 21.7–357.7 mm, flat (ProVision 32″)
  9.5–408.6, portrait 7.9–692.1, and dell-u2724d (procedural) 108.2–443.8 × scale. Screen top = shelf + p.y + glass
  top × scale.
- **Viewing distance.** Desk-driven people stand `BEHIND_KEYS` (sit 470, stand 415, plus reach offset) behind the
  keyboard centre on the featured desk, or `REACH` from the anchor at a station (room-people.mjs). Static `at`
  placements (Yara, Kai, Mia in the power chair) are taken with hands on the keys (wrist + 85 mm = keyboard centre, the
  same as the BEHIND constants). Distance is eye to the glass centre in 3D. The angle uses the horizontal distance,
  including any sideways offset of the screen.
- **Rule.** The top of the screen at or slightly below the eye. The centre 15 to 20° below horizontal; outside 5 to
  30° is out of the guideline. Viewing distance 500 to 750 mm. Positive angles below mean the eye looks **down**;
  a negative top angle means the top is above the eye.
- **Accuracy.** Heights ±25 mm (cast.py's measured `keys_at` and the GLB model disagree by up to 23 mm at 43.5 in),
  angles ±2°. Station desks use the code's default recipes (`scene-product-reference.mjs` via
  `scenePeripheralRecipe`). A station that a project saved differently, or that was chosen as a "shelf-first"
  (monitor-free) station, would differ. No render was made, so framing comes from existing stills and the cut's people
  timing only.

## Who moves the screen, and how far

- **Parameter.** The display accessory's `transform.p.y` (mm, on the `shelf` mount, + = up) in the desk's objects. The
  monitor arm is passive. `fitMonitorArms()` re-poses the single arm's rigid links (`fitRigidSingleArm`), or bends the
  dual arm's vertices, toward wherever the display is.
- **Range (single arm, library, occ, hbhs and stations).** The links are 339.6 + 311.5 mm from the clamp
  (`singleArmRig`), so the screen can go **up to p.y ≈ +350** (wide or flat) before the arm cannot reach. It can go
  **down to ≈ −200** (wide or flat, panel bottom 10 mm over the desktop) or **≈ −318** (dell × 1.2). The dual arm
  (office preset) has no hard reach limit in code (vertex bend), with the same lower bound.
- **Where it is set.**
  - Featured desk: `preset-defaults.mjs` rows. library and occ wide-monitor `[-0.96, -80, 335.48]`; hbhs flat-monitor
    `[0, -80, 335.48]`; office wide `[323.6, -60, 316]` and portrait `[-357, -165, 341]`.
  - Stations: `scene-product-reference.mjs` recipes (office wide −60, music wide −70, library wide −80, occ flat −70,
    compact dell −166.3 × 1.2, creative 48 → artist flat −89.8 × 1.1).
- **Per-chapter override in the cut, no code change:** `deskObjects: {"accessory-wide-monitor": {"p": {"x": …, "y": …,
  "z": …}, "q": {…}}}` (`film-fx.mjs` around line 970, featured desk only, static for the chapter). Do **not** use
  `accessories.add[{id, y}]` for this. Its x/y/z are applied only when the same entry list toggled some catalog
  accessory (`installDeskObjects`, the `if (out.toggled.length)` block). That is why it works in media (arm swap) but
  would be ignored silently in commons. Station desks have no cut knob except a `sceneEdits` position on
  `^Accessory:<display>$` with `near` (world offset, applied once). That is riskier: the app can rewrite the saved
  transform.

## Results per chapter

Columns: posture (built in), desk, eye height, screen top / centre, viewing distance, centre angle below horizontal,
top angle (− = top above the eye), head pitch (posture / neutral), verdict, suggestion.

### 1 awaken, 8 awareness, 12 hero (product room)
Nobody cast. Not applicable.

### 2 rise (home, office preset, starts 0:43.35). Maya, desk-driven
| Time (chapter / film) | Posture | Desk | Eye | Top / centre | Dist | Centre ∠ | Top ∠ | Head | Verdict | Suggested |
|---|---|---|---|---|---|---|---|---|---|---|
| 0–3.4, 12.65–18 / 0:43–0:47, 0:56–1:01 | sit-type (28) | 28 in | 1152 | 1187 / 1019 (wide) | 749 | 10.3° | −2.7° | 10° / 17° | OK (top 35 mm over eye, at the distance limit) | keep −60 (ideal −119, minor) |
| same | sit-type, portrait screen | 28 in | 1152 | 1416 / 1074 | 723 | 6.2° | −20.1° | | Secondary screen 26 cm over the eye (a 700 mm tall portrait panel) | keep; it is a reference screen |
| 7.6–9.45 / 0:51–0:53 | stand-type-41 (41) | 41 in | 1506 | 1517 / 1349 | 671 | 13.6° | −0.9° | 14° / 17° | **Good** | keep |

### 3 create (artist)
Lin paints at the tilted top (stand-paint, from 19.5 s). No screen task. Not applicable.

### 4 commons (library, library preset, starts 1:21.85)
| Time | Person / posture | Desk | Eye | Top / centre | Dist | Centre ∠ | Top ∠ | Head / neck / trunk | Verdict | Suggested |
|---|---|---|---|---|---|---|---|---|---|---|
| 0–5.3 / 1:21.9–1:27.2 | **Yara**, `stand-mid` (39), static `at` | 39 in, tilt −5 | 1400 | 1446 / 1278 | 553 | 12.7° | −4.9° | **24° / 40° / 8°** (stand-type: 14° / 32° / 3°) | Screen within guideline, top 46 mm over her eye. **The posture reads as hunching** | Posture: `people-yara-stand-type` built at 39. Screen p.y −80 → **−150** (top 45 mm under her upright eye, centre 19°) |
| 12.6–16 / 1:34.5–1:37.9 | Mia, `power-type-30` (30) | 30 in | 1114 | 1217 / 1049 | 678 | 5.4° | −8.7° | 11° / 18° | Borderline (looks almost level, top 10 cm over her eye) | p.y −150: centre 11.2°, top −2.9° (a compromise with Yara; ideal for her alone ≈ −201, the floor of the range) |

One deskObjects value serves both: **−150** (Yara upright: top −45 mm, centre 19.2°; Mia: top +34 mm, centre 11.2°).

### 5 coast (OCC media lab, occ preset, starts 1:36.35)
| Time | Person / posture | Desk | Eye | Top / centre | Dist | Centre ∠ | Top ∠ | Head | Verdict | Suggested |
|---|---|---|---|---|---|---|---|---|---|---|
| 0–3.6 / 1:36.4–1:40.0 | **Ava**, sit-type (28) | 28 in | 1071 | 1167 / 999 | 673 | 6.1° | −8.2° | 9° / 16° | Screen high (top 96 mm over her eye) | p.y −80 → **−190** |
| 7.6–14.5 / 1:44.0–1:50.9 | **Ava**, `stand-mid` (39) | 39 in | 1346 | 1446 / 1278 | 567 | 6.9° | −10.0° | **23° / neck 42°** | Screen 10 cm high **and** hunched posture | `ava-stand-type` at 39 + p.y **−190** (centre 18.3°, top 34 mm under her eye) |
| whole chapter | Maya, bay film-edit-01 (office 60 recipe) | 28 | 1152 | 1187 / 1019 | 722 | 10.7° | −2.8° | 10° | OK | keep |
| whole | Andre, sound-mix-02 (music 60) | 28 | 1202 | 1177 / 1009 | 729 | 15.4° | +2.1° | 12° | **Ideal** | keep |
| whole | Lin, digital-art-03 (creative 48 → flat ×1.1) | 28 | 1111 | 1249 / 1029 | 725 | 6.5° | −10.8° | 11° | Screen 14 cm high (if this bay has a monitor; it may be the shelf-first one) | source −89.8 → −201 (centre 15°) |
| whole | Omar, accessible-edit-04 (occ 48 flat), wheel-type-28 | 28 | 1230 | 1227 / 1028 | 702 | 16.7° | +0.2° | 12° | **Ideal** for the screen (the desk is 2.3 in low for his arms: elbow audit) | keep |

One value covers both of Ava's stances: −190 (sit: 15.2° / +1.2°; stand-mid: 17.6° / +1.1°).

### 6 oilers (high school, hbhs preset, starts 1:49.35, now 15 s)
| Time | Person / posture | Desk | Eye | Top / centre | Dist | Centre ∠ | Top ∠ | Head | Verdict | Suggested |
|---|---|---|---|---|---|---|---|---|---|---|
| 12.75–15 / 2:02.1–2:04.4 (desk 43.5 → 31 at 8.5–11.5) | **Kai**, wheel-type-31, static `at` | 31 in | 1146 | 1294 / 1094 | 638 | **4.6°** | **−13.1°** | 9° / 16° | **Out of guideline: looks almost level up to a screen whose top is 15 cm over his eye** | featured flat p.y −80 → **−201** (centre 15.2°, top 27 mm over the eye; the floor of the range) |
| whole | Zoe, student-standing (compact 48 dell ×1.2), stand-type (41) | 41 in | 1418 | 1585 / 1384 | 628 | **3.1°** | **−14.9°** | 13° | **Out of guideline: looks up** (dell top 17 cm over her eye) | source −166.3 → **−318** (centre 16.5°). With the elbow audit's 39 in, −270 |
| whole | Mia, window-research (library 48) | 28 | 1083 | 1167 / 999 | 680 | 7.1° | −7.1° | 11° | Screen 8 cm high | source −80 → −150 (12.9°) |
| whole | Fern, project-review (moved, 28 in; compact 60 dell) | 28 | 1042 | 1255 / 1054 | 699 | **−0.9°** | −16.9° | 11° | **If it has a monitor: looks UP** (top 21 cm over her eye). Likely a shelf-first station (`chooseShelfStations` ranks project/review first), so no monitor | check in the Studio; if present, −318 |

### 7 wellness (gym, office preset, starts 2:02.85; the integration-3 timing)
| Time | Posture | Desk | Eye | Top / centre | Dist | Centre ∠ | Top ∠ | Verdict |
|---|---|---|---|---|---|---|---|---|
| 0–6 / 2:02.9–2:08.9 | Maya sit-type | 28 | 1152 | 1187 / 1019 | 754 | 10.2° | −2.6° | OK |
| 12.3–16 / 2:15.2–2:18.9 (stretch 9.7–12.3) | Maya stand-type-41 | 41 | 1506 | 1517 / 1349 | 676 | 13.5° | −0.9° | **Good** |

### 9 music, 10 media, 11 storage
- music: nobody at the desk (Kai on the sofa).
- media: Omar watches from his wheelchair at [930, 720]. Not at the desk.
- storage: Andre holds the robot at 43.5 in (eyes on the robot, not the screen). Not a screen task.

## Summary: who is outside the guideline

| # | Chapter, film time | Person | Problem | Fix |
|---|---|---|---|---|
| 1 | commons 1:21.9–1:27.2 | **Yara** | Hunched look from the `stand-mid` posture (head 24°, neck 40°, trunk 8°). Screen OK (centre 12.7°, top 46 mm over the eye) | Posture `stand-type` at 39; `deskObjects` wide p.y −150 |
| 2 | coast 1:44.0–1:50.9 | **Ava** standing | Same `stand-mid` hunch, and the screen 10 cm high (6.9°) | Posture `stand-type` at 39; p.y −190 |
| 3 | oilers 2:02.1–2:04.4 | **Kai** | Screen 15 cm over the eye, 4.6°: looks up | `deskObjects` flat p.y −201 |
| 4 | oilers, whole chapter | **Zoe** (background) | Dell 17 cm over the eye, 3.1° | Station source −318 (or sceneEdits) |
| 5 | oilers, whole chapter | Fern (background) | −0.9° *if* her station has a monitor | Verify; −318 |
| 6 | coast 1:36.4–1:40.0 | Ava seated | 6.1°, top 10 cm high | Same −190 as item 2 |
| — | rise and wellness Maya, coast Maya, Andre, Omar | — | In guideline | none |

**Camera read.** The two shots where the posture reads as poor are Yara (commons opening, close three-quarter rear,
she fills the frame) and Ava standing at the featured coast suite. The seated `sit-type` and `wheel-type` postures
are upright (head 9 to 12°, below the neutral 16 to 19°), so they read well even where the screen is high. In those
shots the screen-high problem is a "looks up" read that hardly shows on camera; it is a correctness fix more than a
look fix. The background stations (Zoe, Fern, Lin, Mia) were not verified for framing.

## Fix plan (half page)

**A. Posture (the actual hunch: Yara, Ava).**
- `tools/people/cast.py`: give `stand-type` a 39-in build for Yara and Ava, the way `zoe-stand-type` (41) and
  `maya-stand-type-41` exist. For example, add `{'id': 'people-yara-stand-type-39', 'character': 'yara', 'pose':
  'stand-type', 'height': 39}` and the same for Ava, or add 39 to `DESK_HEIGHTS['stand-type']` for those two only.
- Rebuild the two posture GLBs and the rig JSONs (Blender bake; this is GPU or Blender time, not render time).
- Cut, two edits: commons `people.cast[yara-works].id` → `people-yara-stand-type-39`; coast `cast[ava-stands].id` →
  `people-ava-stand-type-39`. Hands stay on the 39-in keys; the stance is upright (head 14°, neck 32°, trunk 3°).
- An alternative with no rebuild: soften `stand-mid` itself (`spine (2,3,3), neck 5, head 4, pelvis_pitch 0` with reach
  .31). That changes every `stand-mid` in the studio, so it is riskier.

**B. Screen heights. Cut only, 3 parameters, no code.** Add a `deskObjects` entry per chapter for the featured desk's
display:
- commons `"accessory-wide-monitor": {"p": {"x": -0.96, "y": -150, "z": 335.48}, "q": {"x": 0, "y": 0, "z": 0,
  "w": 1}}`;
- coast the same with `"y": -190`;
- oilers `"accessory-flat-monitor": {"p": {"x": 0, "y": -201, "z": 335.48}, "q": identity}`.

The arm re-poses itself. Rise and wellness need nothing. Check in the review still: the arm links at the new pose, and
the panel bottom clearing the keyboard tray and desktop (at −201 the panel bottom is 10 mm over the desktop
surface at the panel's position). The tray is in front, so the screen hides no keys from camera.

**C. Stations (background, optional).** Zoe (dell −166.3 → −318) and Mia (window-research −80 → −150) are in
`scene-product-reference.mjs` recipes or by a `sceneEdits` position with `near`. Editing the recipe changes every room
that uses compact or library stations, so a per-room override is safer. Do this only if those desks are in frame.

**Risks.**
- deskObjects is static for the chapter. One value fits both users per chapter (shown above), but Mia in commons stays
  at 11° (acceptable).
- The ±25 mm height uncertainty is close to the margins at −201 (lower bound). Check one still per chapter before
  committing.
- The posture rebuild changes hand and eye positions. Re-check Yara's hands on the keys at 39 in and Ava's at 39 in
  (the elbow audit found that 39 in fits both).
- Do not raise the screen as originally proposed. That would increase "looks up" for every short user, and Yara's
  head would still be tipped down.
- `accessories.add` with y on an already-present display is silently ignored unless something toggles. Use
  deskObjects.
