# Intro refinement HQ8: Vico's HQ7 notes, the preset finale, polish

Baseline: HQ7 (`cinematic-intro-20261103-hq7`). HQ3 to HQ7 are untouched. 13 chapters, **3:17.0 (197.0 s)**: the finale grows from 14 to 23 s; nothing before 174 s moves.
Direction docs: `/home/ergo/logs/safety_chapter_direction_v2_2026-11-03.md`, `finale_and_film_direction_2026-11-03.md`, `copy_review_2026-11-03.md`. Brief: `video_round3_brief_2026-11-03.md`.

## Deliverable
`final/ErgoFlex-Intro-1080p-HQ8.mp4`: 239,719,587 B, 197.0 s, 9.53 Mbps video (HQ3/HQ7 encode: CRF 9 slow master, CRF 18 slow, 9.5 Mbps cap), -16.0 LUFS, peak -1.9 dBFS, sha256 cd0cee41…7001580b. Seeds (`post/occ-seed.json`, `post/finale-seed.json`) are not committed: rebuild them from studio-state.json at 35b55cf with `tools/studio-state/derive-seed.mjs` (see the render scripts).

## 1. No green arrival light
- The film's `target` state is gone from `film-status.mjs` and from the safety chapter. Each state now fades back to the regular look (the stage's own cyan, `#47cfff`) over 1 s, as the desk restores its snapshot.
- HQ7's green wash at 1:32 had a second cause: after a state ended the spill colour was never restored, so the floor and shelves stayed green until the next state. Fixed the same way.
- The target_reached chime went with the green, so it is gone too. No other chapter had a green arrival (ch 1's 360 turn plays with the strips off).

## 2. Rotation: the wings run the other way
- `film-status.mjs` re-samples rows 5 and 6 (the wings) with the real drive mode after the preview's rotation reversal, so the wings now match the firmware's `fxWheels` case 5/6 and the other six strips are unchanged. Two frames 0.1 s apart, mode 5: wing 5 head 7→6 and wing 6 3→4 (HQ7: 3→4 and 7→6); strips 0, 2, 3, 7 identical to HQ7.
- The app's own `led-movement.mjs` is not changed (film only).

## 3 and 8. Safety chapter v2 (85.5-101.5 s, still 16 s)
| chapter s | camera | desk | light |
|---|---|---|---|
| A 0.0-3.2 | low front 3/4, trucking left (coast's drift) | starts at **-5°** tilt; lift 28→40 in (0.2-4.0) | blue wavefront, strip 2 dark (the API's `liftDarkStrips`) |
| B 2.4-7.1 | side 3/4 from the desk's right, lens at desktop height, still then a slow push | tilt -5°→0° (3.4-4.6, starts as the lift lands); 45° left turn (5.6-7.8) | **purple** FX35 retract (the code's colour: -5→0 is a retract; yellow is extend), fade to regular, rotate comets |
| C 6.3-16.0 | low 3/4 across the roll so the gap reads, then a crane up into oilers | rolls 7 in to one pylon (7.8-9.4), stops short; backs off 3 in (12.7-13.9) | forward comets; **proximity amber**, the desk's real FX2 breathe (one per ~3.1 s, dark-bottomed), latched through the back-up: two breaths (peaks 10.95 and 14.05) for "flashes a couple of times"; released at 14.1, back to regular by 15.1 |
- A>B and B>C: 0.8 s dips through black mid-move; 1.5 s dissolves in and out.
- Sound: the HQ7 status section without the chime, plus the desk's `movement_wheels` sound under the roll (18 dB down, cut as it stops). No proximity tone: the desk has none.
- Ch 9 keeps its proximity stop: ch 9 is sensing (several pylons, rings), ch 6 is the signal people around the desk see.

## 4. Game chapter (ch 10): HQ6 + one third
- Target = HQ6 + 1/3 of the HQ6→HQ7 rise, measured on the renders at 2:16 / 2:21 / 2:22 (mean luma HQ6 94.5/35.7/34.6, HQ7 111.8/44.1/42.7 → target 100.3/38.5/37.3). Tuned on short test renders: `ledGain` 1.4, desktop/floor/base 165/162/72, environment 0.82, lamps 0.77. HQ8 measures **101.3/40.2/39.1** (p95 193/140/140). The video-driven stripes (media mode) stay.
- Side by side: `review/ch10-hq6-hq7-hq8.jpg`. Movie night (ch 11) is HQ7's render, unchanged.

## 5. Ch 12 storage: off the rug
- Roll 95 in (was 55), 6.0-13.15 s, trapezoid at 16 in/s: the trailing casters stop on the tile past the gold edge. Tilt in 4.3 s. The Leap moved off the rug (room [8000, -3700] mm). Lights out from 13.6 (lamps to 0.15, ambient to 0.25), screen and underglow on. Humboldt-gold LED (`#f19c00`) instead of cyan; storage grade temp 0.05→0.09. Camera tracks the longer roll and ends at y 3.2 on the parked desk, which sits where ch 13's desk opens. `build-storage-chapter.py`.

## 6. Finale (ch 13, 174.0-197.0 s): the desk changes through the shop's presets
- gaming → office → artist → OCC → HBHS → gaming (Vico: keep the school logos), about one bar (2.07 s) per look, 0.7 s soft wipes (`smoothleft`) centred on the bar lines; one camera, pose and light rig for all six (`build-finale.py`, `join-subshots.py --transition smoothleft`).
- Origin check: the saved office build carries its own desk pose (yaw 29°, x 0.5) and OCC a small one (2.6°); rendered as saved, the desk jumped inside the wipes. The finale renders from `post/finale-seed.json`, the shared state with every preset's desk pose zeroed (`derive-seed.mjs --zero-preset-poses`); studio-state.json is untouched. The artist build's shelf organizer lands under the floor at tilt 0 (it is saved at 65°) and is hidden in that look.
- Stronger rims (260) and pool (0.4) so the black frame reads. Headline once it is back on black and red, logo hit on 191.32, CTA "Make it yours." held to the end.
- Score: from the 174.75 bar line, a `finale` style: one chord per look (D/F#, Gmaj9, Em9, Bm9, Asus4, A), then Gmaj9 · Asus4 into the logo hit.

## 7. OCC multimedia art lab (ch 5 coast)
- Vico's Chrome edits are committed (`35b55cf`). They are on the **premium** layout's main desk (`occmedialab/premium`): headphones (530, 0, -110) → (534, 49, -43) mm turned 88°, journal (-540, 140) → (-245, -52), slate (0, 0) → (-52, 2), groove tabletop (340, 150) → (480, 199). The film's ch 5 uses the **house** layout, and the stage resets a layout room's saved desks to the authored defaults, so `--storage` alone cannot carry them. The ch 5 shot now carries the four transforms (`deskObjects`, placed through the app's object editor after prepare). No other chapter uses an OCC room desktop (the finale's OCC look is the product-stage preset).
- The wall display is dimmed to 0.6 so the eye lands on the desk (finale doc C4).

## Seams (assembly only)
Six cross-room dissolves showed two desks at once. `finish-intro.py` now takes a type per seam: `smoothleft` at 64.25, 76.75, 110.25 (the outgoing camera's drift); `fadeblack` 0.8 s at 123.75 and 134.25 (into and out of the dark studio, like ch 6's dips) and 1.0 s at 159.25 (warm movie night to the library).

## Copy (old → new; Vico can veto any)
See the report; every line is in `titles-src.json`. The safety headline stays as approved ("Safe for everyone around it."); the copywriter's alternative is "Seen and heard." / "Light and sound tell the room when it moves."

## Not adopted
- Ch 1: moving the 22.5-25 s lift earlier (a 34 s re-render; Polish: polish only where it costs no re-render). Ch 1's base rig likewise.
- The parking chime in ch 12 (no arrival cues, same as note 1).
- Per-wipe reversed-bell swells in the finale (the chord change on each bar carries the wipe).
- The doc's strip-5-pixel-0 diagnostic: the Custom Shop strip map is the stale 10-03 one, and the doc says not to port the 10-06 map here; the wing fix is checked on the frame data instead.
