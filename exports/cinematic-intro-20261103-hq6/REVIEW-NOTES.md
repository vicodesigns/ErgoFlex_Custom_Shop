# Intro refinement HQ6: status-indicator chapter

Baseline: HQ5 (`cinematic-intro-20261103`). HQ3, HQ4 and HQ5 are untouched. 13 chapters, 3:08.0 (188.0 s).

## New chapter 6 "status" (85.5-101.5 s), between coast and oilers
Dark studio, the same desk, preset and productRig lighting as chapters 1 and 12. One 16 s camera spline.
| chapter s | what | light | sound |
|---|---|---|---|
| 0.8-3.0 | lift up 28 to 46 in | blue 0,0,255, FX34 vertical wavefront | movement_lift_up |
| 3.0-3.9 | target reached | solid green 0,255,0 | target_reached |
| 4.2-5.9 | lift down to 32 in | red 255,0,0, FX34 reversed | movement_lift_down |
| 6.0-9.6 | 8 drive directions in a closed ring (fwd, R-fwd, R, R-back, back, L-back, L, L-fwd) | FX36 comet in travel red with caution amber 255,70,0, drive modes 3,9,2,10,4,8,1,7 | movement_wheels |
| 9.7-11.0 | full turn | FX36 mode 6 | movement_wheels |
| 11.2-12.2 | approach a pylon | FX36 mode 3 | movement_wheels |
| 12.2-14.6 | collision stop, desk 2 cm from the pylon | latched breathing red | collision_alarm |
| 14.8-15.8 | back away | FX36 mode 4 | movement_wheels |
Title "Know what your desk is doing." / "Blue rises. Red lowers. Amber warns. Green arrives."

## Sources (read-only, main repo)
- Colours and effects: `ErgoFlex_Stack/ergoflex_api/services/led_status_indicator_service.go` (ColorLiftUp/Down, ColorTargetReached, ColorCollision, ColorProximity, ColorWheels*) and `ergoled_native_anim.go` (FX 34/35/36, drive modes 1-10, `wheelsColorsForMode`).
- Sounds: `ergoflex_api/audio/safety_indicators/*.mp3`. Four already lived in `assets/led/audio`; `collision_alarm.mp3` (13 KB) was copied in.
- Animation: the Custom Shop twin's own `led-movement.mjs` sampler (source-derived firmware FX 34/35/36), fed through `tools/experience/film-status.mjs`. No colour was invented. The collision red uses the twin's roomSafety pulse (255,16,12). Proximity amber is implemented (twin 255,145,8) but not used in this chapter.
- Wheel direction labels follow the app: director +z is the app's forward (mode 3), director +x is strafe left.
- Not in the chapter: proximity amber stop, tilt (yellow/purple). Those are the next candidates if wanted.

## Audio
`score.wav` cut at the coast/status dissolve centre (86.25 s, a bar line), a 14.5 s bridge inserted (the opening "wake" pad, Dmaj9, stretched with atempo 0.822, 0.3 s crossfades), the rest of the score follows 14.5 s later. Checked: the music after the bridge correlates 0.9996 with the original at a 14.5 s offset (1.2 ms), so every later cue is where it was, just later. The real sounds are mixed at -5 dB (chime 0 dB). Integrated -16.2 LUFS, true peak -1.9 dBFS.

## Build
`build-status-chapter.py` (shot, camera `status-camera.json`, EDL, titles, grade) -> `render-cut.cjs --shots 5 --video --blur 4 --ss 1.5` -> `build-status-audio.py` -> `finish-intro.py --wip`, WIP copied to `ErgoFlex-Intro-1080p-HQ6.mp4`. Other chapters are reused from HQ5 by symlink.

## Limits
- The bridge is a time-stretched existing pad, not a new composition; the music thins for the 14.5 s on purpose so the sounds read.
- The lift-down red is the least distinct light (it shares the desk's red trim); blue, green and the collision red read clearly.
