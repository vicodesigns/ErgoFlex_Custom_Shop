# Intro HQ11: the final expert panel's fixes (round 6)

Baseline: HQ10 (Vico's round-5 notes). 12 chapters, **2:58.5 (178.5 s)**, 2560×1440.
Panel (all Opus 5.5, /home/ergo/logs/final_review_*_2026-11-04.md): cinematography, lighting/grade, copy, content/product,
desk movement, home/creative settings, education settings. Implemented under /home/ergo/logs/round6_protocol_2026-11-04.md.

| ch | id | change | builder |
|---|---|---|---|
| 1 | awaken | 39.5 s (trimmed hold); black desktop stays black under the status lights (the rear rims were whitening the gloss), so blue no longer reads lavender; one-frame LED pop after each status light removed (film-status fix, all chapters); SAFETY sub "Light and sound tell the room when it moves." | build-opener.py |
| 2 | rise | opens on the tablet; height readout fully in frame; slower pan; softer window | build-round6-home.py |
| 3 | create | 45° beat framed whole; loose pencils off the tilted board; drafting stool instead of the task chair; sub "From drafting to digital painting." | build-round6-home.py |
| 4 | commons | the desk really drives to the table now (HQ10's 155 in target was clamped at 120 by the film engine; now ±240): one drive out of the bay, arriving by 11.6 s at real glide speed, flush with the table's side, 5 in off its head, square to the wheelchair, which is pulled up to the keyboard tray and fully in frame; turn/forward lights; the "Bring your desk to the group" board hidden; plain dissolve into coast | build-round6-commons.py |
| 5, 9, 10 | coast, music, media | grade lifts (coast was the darkest daylight room); trimmed static tails (9.5, 11, 11 s) | build-round6-grade.py |
| 6 | oilers | title "Space to discover." | build-round6-copy.py |
| 7 | wellness | blue lift light on the stand break; floor pool no longer clips; a seat for the 28 in view; 13 s; sub "Pause. Stretch. Breathe. Reset." | build-round6-home.py |
| 8 | awareness | stops on the amber (no 0.8 s overrun); amber no longer clips to pale yellow; card over the stop | build-awareness-chapter.py |
| 11 | storage | fold and roll at the real desk's speeds (≤7°/s, ≤12 in/s) with purple then red lights; desktop cleared from the start (nothing vanishes); neutral light (no cyan cast); wheelchair no longer parked like stored furniture; monitor follows the routine and sleeps; sub "One tap: fold to 65°, roll to the wall." | build-round6-storage.py |
| 12 | hero | OCC hot spot gone; black desktops black (luma ~60, was ~200); portrait monitors show content; end-card shade no longer dims the desk; gaming lift-down within the lift's speed; "Let’s build yours." | build-finale.py v3.1 |
| all | | score re-synthesized for 2:58.5 with the desk's own lift/tilt/wheel sounds under its lights | build-round6-audio.py |

## Not done (needs new screen recordings or an owner call)
- Rise tablet app shows the gaming desk twin; wellness screens (desk squats, breathing vs heart rate); gaming montage captions.
- Finale tilts f1/f3/f5 run at montage speed (2-3x the real tilt) to fit the 2.67 s looks: deliberate, or lengthen the finale?
- Content panel options: cut the media chapter (gaming and cinema both show screen-following light) or move sensing after commons.
- Opener floor spill for blue/purple/yellow is limited by the app's surface caps (200/100).

## Owner choices (do not reverse)
Keep the powered wheelchair. Ch 3 drafting below 50°. LED strips match screens. Tilt angle increasing = purple, back
toward flat = yellow-green; lift up blue, down red; red while gliding. "A place for everyone." and "Let’s build yours."
