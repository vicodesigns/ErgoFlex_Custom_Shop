# Intro refinement HQ9: Vico's HQ8 notes (round 4)

Baseline: HQ8. HQ3 to HQ8 untouched. 13 chapters, 3:17.0 (197.0 s), same timing as HQ8.
Brief (Vico's words): `/home/ergo/logs/video_round4_brief_2026-11-03.md`. Expert docs: `cinematography_review_round4_2026-11-03.md`,
`lighting_review_round4_2026-11-03.md`, `copy_commons_round4_2026-11-03.md` (all in /home/ergo/logs).
First round rendered in parallel (3 at a time, cores 2-7,10-15; `renders-new/render-queue.sh`).

## Why ch 2 and 3 showed no lift/tilt light
The render path never plays the app's movement lights (`bakeDraw` skips `ledMotion.observe`), so a chapter only shows a movement
light if its shot lists `ledStatus` events. Ch 2 and 3 had none. They now do, matched to their motion clips. Desk accessories (drafting
board, paper, easel, monitors) take no LED spill in the app, so `film-status.mjs` gained `ledFill`: a point light at the desk in the
state's colour and brightness while a state plays (off at rest).

| ch | change | builder |
|---|---|---|
| 2 rise | blue lift-up on both rises (ledGlow .75, rest white #808080, strong desk/floor spill, ledFill); tablet clip +2 s so its lifts run with the desk's; camera aims lower (floor in frame) and no longer reverses at the end | build-round4-lighting.py, build-round4-camera.py |
| 3 create | yellow-green tilt-up (Vico: the real desk shows purple tilting down, green-yellow tilting up) on both tilts with ledFill on the board and room; camera one-way with a 1 s rest at the side profile (the "jerk" was a key where the path doubled back at speed) | same |
| 4 commons | final glide 9.6 in further: the desk's edge meets the white table's edge (reading lamp moved onto the table); camera under 1.35 u/s; sub "Bring your desk to the table." | build-round4-camera.py, titles-src |
| 6 safety | one continuous camera, no sub-shots/dips: 3/4 from above through the lift (28→46 in, 0.4-6.0), fly down to desktop height for the tilt (-5→0, tilt-up yellow-green, 7.0-10.0), 45° right turn (mode 6, 10.3-12.5), 10 in roll (12.5-14.5); no pylon, no proximity; dim neutral standby so each colour reads; wheels sound moved to the new roll | build-safety-chapter.py v3, build-hq8-audio.py |
| 9 sensing | one pylon in the path (the stage's decorative pylons hidden), roll 6.0-8.8, desk's amber proximity breathe from 8.0 (peak ≈ 9.55), side-on camera on the gap | build-awareness-chapter.py |
| 12 storage | working library at night: room lights ×2.2, hemi/directional 1.5, environment 1.5, exposure 1.14, stage cyan LED as a small accent (.25), grade temp .03; the end-of-chapter dimming removed; camera rests at "Track the roll" | build-round4-lighting.py |
| 13 finale | artist (painter 65°) → OCC → architect (drafting) → HBHS → office (rises to standing) → gaming (down to sitting, ergonomic keyboard); one desk performance and one camera in all six sub-shots, so 0.6 s blends on the bar lines change only the finish; product rig (side key, kicker, low front fill, overhead lights cut), exposure per finish, grade without the mid-lift curve | build-finale.py v2 |

## Not adopted / notes for Vico
- Tilt colours follow Vico's real desk: tilting down purple, tilting up green-yellow (the Custom Shop viewer has this inverted; flagged to
  Polish). Ch 6 keeps his -5° → 0° (a tilt up, so yellow-green), lengthened to 3 s so it reads.
- The finale no longer opens on the gaming desk: it opens on the painter at 65°, which matches ch 12's folded desk for a match dissolve,
  and ends on gaming. If black/red first is wanted, the drafter look is the one to drop.
- Ch 1 camera pull-out speed (1.61 u/s at 0:04): not re-rendered (34 s chapter).
