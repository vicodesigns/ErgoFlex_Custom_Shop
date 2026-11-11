# Intro HQ12: Vico's HQ11 notes (round 7)

Baseline: HQ11. 12 chapters, **3:23.5 (203.5 s)**, 2560×1440. Brief: `/home/ergo/logs/video_round7_brief_2026-11-04.md`
(items 2-13 and the start of 14 were lost in the paste; Vico will resend them for the next round).
Experts (Opus 5.5): floor lighting, finale cinematography/desk motion.

| ch | id | change | builder |
|---|---|---|---|
| 1-4, 7, 8, 11 | awaken, rise, create, commons, wellness, awareness, storage | item 1: the two side-wing LED strips now light the floor beside each wing in the status colour (blue lift, purple/yellow-green tilt, red roll/turn, amber proximity), following lift, tilt, glide and turns; the app's hard-edged foot box is replaced by a soft pool (film-fx `floorLight`; the app is unchanged) | build-round7-floor.py |
| 12 | hero | items 15-17: finale v4, 23 > 48 s. Each desk performs its own move at the real desk's speeds (lift 4.5 in/s, tilt 6.8°/s; no montage-speed tilts) and rests before the next blend; v3's orbit re-timed slower. Architect to full sitting 28 in / -5°; OCC to 48 in / 30° (item 14 guess); office is now a financial analyst: portfolio (portrait) and markets/DCF (curved) screens, padfolio and pen, glasses, calculator, mug; every other monitor keeps the app home (no logo-only screens) | build-round7-finale.py, screens/scenes/ch13.js, ch12.js `homeUntil` |
| all | | EDL and score re-timed for 203.5 s | build-round5-edl.py, build-round6-audio.py |

## Open
- Items 2-14 (resend). Item 14's "around 48 inches": set on OCC (B); if it was the artist (A), change `'A': (43.5, 65)` to `(48, 65)` in build-round7-finale.py.
- Finale pan through A-E is slow (~1.3°/s) by design (calm); say if it feels too still.

## Owner choices (do not reverse)
Keep the powered wheelchair. Ch 3 drafting below 50°. LED strips match screens. Tilt angle increasing = purple, back
toward flat = yellow-green; lift up blue, down red; red while gliding. "A place for everyone." and "Let’s build yours."
