# ErgoFlex film: elbow and desk-height audit (read-only)

Worktree: `C:\work\ergoflex-cine-s4`, branch `cine/s4` at 04f24e0. Cut: `exports/cinematic-intro-cut-cine/review-cut.json`.
Trigger: NOTES.md section 6. Vico says the library student's desk is too high and she is reaching up to it.
Nothing in the repo was changed. The scratch scripts are `C:\work\cine-pics\audit\fk_elbow.py` and `fk_all.py`.

## Method (how each number was obtained)

- **Joint positions are exact, not eyeballed.** I ran forward kinematics on each built model's skeleton
  (`assets/props/people-rigs/<who>.json`: bones, parents, offsets, and per posture the root, pelvis and bone quaternions).
  That gives the world heights of the shoulder (`upperarm_*`), elbow (`lowerarm_*`) and wrist (`hand_*`) as built.
  From these I computed the elbow angle, the forearm pitch (+ means the hand is above the elbow) and how far the upper arm
  swings forward of vertical. Error is about ±2 mm and ±1°.
- **Desk posture fit.** A desk posture's hands are placed at an *absolute* keyboard height,
  `keys_at(in) = 0.678 + (in − 28) × 0.0269 m` (`tools/people/cast.py` `keys_at`, `sit_type`, `stand_type`, `wheel_type`, `power_type`).
  That height does **not** scale with the person's stature. So `stand-type` puts every character's hands at 1.095 m (43.5 in)
  whether they are 1.88 m or 1.45 m tall. This is the root cause of the Yara case, and it repeats wherever a shorter
  character stands at 41 to 43.5 in.
- **Ideal height.** The relaxed elbow height is the posture's shoulder height minus the upper-arm length (upper arm hanging).
  Target: forearm horizontal, meaning the wrist joint at that height. Ideal keyboard height = relaxed elbow − the posture's
  measured wrist-over-keys offset (4 to 6 cm). That is converted back to a desk setting through `keys_at`.
  Uncertainty is about ±1 in. It comes from spine lean, the shoe sole, keyboard tray versus desktop, and desk tilt
  (commons and coast run at −5°).
- **Seated cases.** The task chair seat is fixed at 435 mm (Leap, cast.py `SEAT`). The desk minimum is 28 in
  (`studio.js` `HEIGHT_MIN = 28.0`). A seated ideal below 28 in therefore means "at the minimum, fine for the desk". Any
  further fix would be a higher chair or a footrest, not the desk.
- **Verdict rule.** OK when the forearm is within about ±12° of horizontal and the setting is within about 1.5 in of ideal.
  Beyond that it is too high or too low.
- **Who is at which desk, and when.** This comes from the cut's `motion` (lift clips), `people` (only/except/cast/when) and
  `sceneDeskEdits`, plus the room casts in `room-people.mjs` (ROOM_PEOPLE, deskFamily: a desk-driven person shows the
  posture built nearest the desk height, within 1.4 in). Station heights come from `institutional-media.mjs` (all bays 28 in)
  and `institutional-education.mjs` (high school stations).
- Rough stature estimates use relaxed standing elbow ≈ 0.63 × stature: Andre ~1.88 m, Maya ~1.70 m, Yara ~1.60 m,
  Zoe ~1.59 m, Mia ~1.54 m, Ava ~1.53 m, Fern ~1.45 m.

Keyboard-top heights by setting: 28 in → 678 mm, 30 → 732, 31 → 759, 32 → 786, 38 → 947, 39 → 974, 41 → 1028, 43.5 → 1095.
Desk setting in mm is inches × 25.4.

## Results per chapter

### 1. awaken (product room)
Nobody is cast (the product room has no ROOM_PEOPLE entry and no DEFAULT_CREW). Not applicable.

### 2. rise (home): Maya at the featured desk, desk-driven (sit-type / stand-type family)
| Person | Posture | Desk (cut) | Elbow / forearm | Verdict | Suggested | Where set |
|---|---|---|---|---|---|---|
| Maya | seated, `people-maya-sit-type` | 28 in / 711 mm (0–3.4 s, 12.7 s–end) | 122°, forearm −5° (wrist 1.5 cm over relaxed elbow) | OK | keep 28 | rise `motion.initial.height`, clip `full-height` |
| Maya | standing, `people-maya-stand-type` (built 43.5) | 43.5 in / 1105 mm (about 7.6–9.45 s) | 86°, **forearm +15°**, wrist 7.5 cm above relaxed elbow, upper arm 22° forward | **Too high** (about 2.8 in) | **about 41 in** (ideal 40.7). With no rebuild: 39 in shows her `stand-mid` (99°, forearm −11°, acceptable) | rise clip `comfortable-standing` target 43.5 |
| Maya | stand-wait (`maya-waits`) | moving | not at the keys | n/a | none | rise `people.cast` |

### 3. create (creative)
Desk at 43.5 → 52 with tilt. Nobody uses it: `only: ["lin-at-wheel"]`, and Lin is at the pottery wheel, not an ErgoFlex desk.
Not applicable.

### 4. commons (library, humboldt)
| Person | Posture | Desk (cut) | Elbow / forearm | Verdict | Suggested | Where set |
|---|---|---|---|---|---|---|
| **Yara** (`yara-works`) | standing, `people-yara-stand-type` (built 43.5), a static `at` placement, not desk-driven | **43.5 in / 1105 mm**, tilt −5 (0–5.3 s) | **82°, forearm +30°**, wrist 14 cm above relaxed elbow (1.149 vs 1.007 m), upper arm 33° forward: she reaches up | **Too high (the known case), about 5 in** | **39 in / 991 mm with `people-yara-stand-mid`** (already built at 39): 87°, forearm +4°, hands on the keys. Strict ideal is 38.2 in | commons `motion.initial.height` 43.5; `people.cast[yara-works].id` |
| Mia (`mia-works`) | power wheelchair, `people-mia-power-type` (built 32), seat 470 | 32 in / 813 mm (12.6 s–end; lift clip at 6.2 s → 32) | 114°, **forearm +15°**, wrist 12 cm above relaxed elbow, upper arm 45° forward | **Too high (moderate)** | **about 30 in / 762 mm**. Her manual-chair `wheel-type-31` is level on a 500 mm seat; the power seat is 30 mm lower, so it is equivalent to about 30 in. Needs a power-type posture built at 30 (cast.py `DESK_HEIGHTS['power-type'] = (32,)`) and a knee-clearance check under the tray | commons lift clip `61c87afa…` target 32 |
| Mia (`mia-waits`) | power-phone | not at the keys | phone in hand | n/a | none | none |
| Sofia, Kai (mates), Leo, Zoe, Eli | sit-laptop / sit-write / sit-listen | at the library long table, not an ErgoFlex desk | none | not audited | none | none |

### 5. coast (OCC media lab, morning; all bays are 28 in, `institutional-media.mjs` `stations()`)
| Person | Posture | Desk | Elbow / forearm | Verdict | Suggested | Where set |
|---|---|---|---|---|---|---|
| Maya (`bay-1`, img38) | seated `sit-type`, station film-edit-01 | 28 in | 122°, −5° | OK | keep | coast `people.cast[bay-1]` |
| Ava (featured desk, `ava-stand-low` family, img39 "student for one second") | seated `sit-type-30` at 30 in (0–4.4 s, if shown; img37 shows the desk empty) | 30 in / 762 mm | 115°, **forearm +12°**, wrist 10 cm above relaxed elbow | Too high if she appears seated | 28 in (`ava-sit-type`: 127°, −1°) | coast `motion.initial.height` 30 |
| Ava | standing; at 38 in the nearest built posture is `stand-mid` (39) | 38 in / 965 mm (from 7.4 s) | model 83°, forearm +10°; at 38 in about +5° (hands float about 27 mm above the keys: posture built 1 in higher) | OK (ideal 37.2 in) | keep 38, or 39 for exact hand contact | coast lift clip `db2144e8…` target 38 |
| Andre | seated `sit-type`, sound-mix-02 | 28 in | 98°, −1° | OK (ideal 28.0) | keep | room cast |
| Lin | seated `sit-type`, digital-art-03 | 28 in | 138°, −11° | OK (slightly low; ideal 27.4) | keep | room cast |
| **Omar** | wheelchair `wheel-type-28`, accessible-edit-04 | **28 in / 711 mm** | 128°, **forearm −18°**, wrist 6 cm *below* relaxed elbow | **Too LOW** (about 2.3 in), and the knees do not clear the tray (cast.py: "31 in lets the knees roll under") | **31 in / 787 mm** (`omar-wheel-type` built at 31: 105°, +1°, ideal). Set it with a `sceneDeskEdits` entry for station accessible-edit-04; his desk family switches to the 31-in posture | `room-people.mjs` occmedialab entry + station height 28 in `institutional-media.mjs` (the cut has no override) |

Omar matters only if bay 04 is in frame in the coast camera. I could not verify framing without rendering.

### 6. oilers (high school)
| Person | Posture | Desk | Elbow / forearm | Verdict | Suggested | Where set |
|---|---|---|---|---|---|---|
| Kai (`kai`) | wheelchair `wheel-type-31` | 31 in / 787 mm (lift 43.5 → 31 at 8–11 s; he types from 10.8 s) | 129°, −1.5° (upper arm 41° forward) | OK (ideal 29.4; 31 is kept for knee clearance) | keep 31 | oilers clip `oilers-demo-lift` |
| Kai (`kai-waits`) | wheel-watch | 43.5 → 31 | not at the keys | n/a | none | none |
| Fern | seated `sit-type`, station project-review moved and set to 28 | 28 in / 711 mm | 136°, −2°, upper arm 48° forward (she reaches forward, not up) | OK for height (at the 28-in minimum; seated ideal about 25.7) | keep 28. If anything, seat her about 30 mm higher or bring the pelvis closer; it is not a desk fix | oilers `sceneDeskEdits[station-project-review]` |
| Mia | seated `sit-type`, window-research | 28 in | 129°, −2° | OK | keep | room cast (not excepted) |
| **Zoe** | standing `stand-type` (built 41), station student-standing | **41 in / 1041 mm** | 89°, **forearm +15°**, wrist 7.5 cm above relaxed elbow | **Too high** (about 2.8 in) | **39 in** (`zoe-stand-mid`: 85°, +5°; ideal 38.2). Add a `sceneDeskEdits` height for station-student-standing; the station family switches | `institutional-education.mjs` station `student-standing` height 41 (room default, not excepted in the cut) |
| Noah | stand-present / stand-wait | not at a desk | none | n/a | none | none |

Zoe matters only if the student-standing desk at [4380, 1000] is in frame. Framing was not checked.

### 7. wellness (gym): Maya at the featured desk, desk-driven
| Person | Posture | Desk | Elbow / forearm | Verdict | Suggested | Where set |
|---|---|---|---|---|---|---|
| Maya | seated `sit-type` | 28 in (0–6 s) | 122°, −5° | OK | keep | wellness `motion.initial` |
| Maya | stretch (6.6–10.35 s) | moving | none | n/a | none | none |
| Maya | standing `stand-type` | 43.5 in / 1105 mm (about 11 s–end) | 86°, **+15°**, wrist 7.5 cm above relaxed elbow | **Too high** (about 2.8 in) | about 41 in, or 39 with `stand-mid` | wellness clip `stand-break` target 43.5 |

Lower confidence: this chapter adds its own keyboard tray (y −28) and keyboard (y −55.5). If those are mm below the desktop,
the keys sit about 2 cm lower than the pose expects. That would leave her hands hovering, not change the verdict.

### 8. awareness (product)
Nobody is cast (a dog obstacle only). Not applicable.

### 9. music (gaming room)
Desk 30 → 47 with nobody at it. Kai is on the sofa with a controller (`only: people-kai-sit-controller`). Not applicable.

### 10. media (music room, night)
Desk at 30 in. Omar is in `wheel-watch`, cast at [930, 720], watching the film, not working at the desk. Not applicable.
If he were placed at it, 30 in would suit him (his ideal is 30.3).

### 11. storage (workshop)
| Person | Posture | Desk | Elbow / forearm | Verdict | Suggested | Where set |
|---|---|---|---|---|---|---|
| Andre | `stand-robot-work` (0–1.7 s) | 43.5 in / 1105 mm | 59° (hands drawn in, holding the robot), forearm +7°, wrist about level with his relaxed elbow (1.195 vs 1.185 m) | OK. 43.5 suits him (typing ideal 44.8) | keep | storage `motion.initial.height` |
| Andre | `stand-robot-shelf` (1.7–3.15 s) | 43.5 + top shelf | upper arm 70° forward: a brief reach to the shelf | OK (transient) | none | none |
| Jo | stand-work at the bench | not an ErgoFlex desk | none | n/a | none | none |

### 12. hero (product, presets)
No `people` key and the product room has no cast. Not applicable.

## Summary of wrong ones
1. **Yara, commons. Desk 43.5 in, about 5 in too high.** Forearm +30°. Fix: desk 39 in and cast `people-yara-stand-mid`
   (already built). Change `motion.initial.height` and `people.cast[yara-works].id`.
2. **Maya standing, rise and wellness. Desk 43.5 in, about 2.8 in too high.** Forearm +15°. Fix: about 41 in (needs a
   `maya-stand-type` built at 41, the way Zoe's is) or 39 in (existing `stand-mid`, forearm −11°). Before relying on the
   switch, confirm that `only` admits the deskFamily member.
3. **Mia in the power chair, commons. Desk 32 in, about 2 in too high.** Forearm +15°. Fix: about 30 in, with a power-type
   posture built at 30 and a knee-clearance check.
4. **Zoe, oilers student-standing desk. 41 in, about 2.8 in too high.** Applies only if in frame. Fix: 39 in through
   `sceneDeskEdits`.
5. **Omar, coast accessible-edit-04. 28 in, about 2.3 in too LOW** (forearm −18°, knees under the tray). Applies only if in
   frame. Fix: 31 in through `sceneDeskEdits`.
6. Ava seated at 30 in (coast opening) would be about 2 in too high if she shows seated. Use 28.

Systemic cause: `stand_type()` and the other desk poses place hands at an absolute keyboard height built for a desk setting,
not at the character's elbow. 43.5 in fits only someone about 1.85 m or taller (Andre). Every female cast member's standing
ideal is 37 to 41 in. A per-character standing height (or stand-mid at 39 by default) would prevent repeats.
