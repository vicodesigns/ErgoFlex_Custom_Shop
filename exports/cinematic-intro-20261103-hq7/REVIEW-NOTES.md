# Intro refinement HQ7: safety chapter, media lighting, encode

Baseline: HQ6 (`cinematic-intro-20261103-hq6`). HQ3 to HQ6 are untouched. 13 chapters, 3:08.0 (188.0 s), same timing as HQ6.

## Movie night (ch 11) and the game chapter (ch 10): the light follows the video again
- HQ3's look (dark room, coloured stripes on the desk taken from the film) is the app's media mode: `film-fx.mjs` samples the picture with the app's own `sampleScreenColours` and feeds the strips per LED.
- The HQ4 shot file only nudged the room lights (environment 0.25 to 0.34, hemisphere 0.3 to 0.42, lamps 0 to 0.08), and the committed tooling renders that file with the stripes. HQ4's own ch 10 render took the uniform-colour fallback instead (one average colour over the desk and the walls: the pink wash), and HQ5/HQ6 reused that render.
- HQ7 movie: media mode as HQ3, a little brighter. Environment 0.42, hemisphere 0.5, directionals 0.65, lamps 0.12, and `ledGain` 3 to 3.5 so the stripes stay strong.
- HQ7 game: same media mode, now with `ledGain` 3.5, desktop/floor strength 200, the room's environment 0.45 and its lamps at 0.3, so the screen's colours (track green, kart yellow and white) lead instead of the room's purple. On the black gaming desktop the bands are softer than on the movie desk's light top.

## Encode
HQ4, HQ5 and HQ6 were built with `finish-intro.py --wip`: a CRF 14 veryfast master, then CRF 19 veryfast with no cap. HQ7 goes back to HQ3's path: CRF 9 slow master, then CRF 18 slow, 9.5 Mbps cap (`--hq-only` skips the textless and 720p files).

| build | video bitrate | file |
|---|---|---|
| HQ3 | 9.50 Mbps | 210,606,514 B / 173.5 s |
| HQ4 | 7.85 Mbps | 174,787,800 B / 173.5 s |
| HQ5 | 7.87 Mbps | 175,208,080 B / 173.5 s |
| HQ6 | 7.86 Mbps | 189,489,240 B / 188.0 s |
| HQ7 | 9.53 Mbps | 228,811,804 B / 188.0 s (sha256 537b30ea…fdb6ed) |

## Chapter 6, safety (85.5-101.5 s), redone
Direction: `/home/ergo/logs/status_chapter_direction_2026-11-03.md`, kept at 16 s so nothing after it moves.
Title: eyebrow **SAFETY**, "**Safe for everyone around it.**" / "**Light and sound let everyone know when it moves.**"

| chapter s | camera | desk | light |
|---|---|---|---|
| A 0.0-5.0 | low front 3/4, trucking left like coast's exit, desk centre-left drifting right under the title | lift 28 to 43 in (0.4-5.93, eased, 2.7 in/s) | blue wavefront |
| B 4.2-11.0 | the other front 3/4, higher, slow push | arrives on the beat; quarter turn left (7.2-11.4, peak 32 deg/s) toward the lens | green on arrival, then the turn comet |
| C 10.2-16.0 | low 3/4 of the new heading, still, then a crane up into oilers' opening crane | rolls forward 14 in (11.4-14.2, peak 7.5 in/s) | comet with caution amber, then green on the floor |
- A>B and B>C: 0.8 s dips through black while the desk moves (Vico: "fade out, fade in at a different angle"). A cross-dissolve here doubled the desk, the same double image as the ghost frame below.
- In and out: 1.5 s dissolves (were 0.6 and 0.8), the length of every other dark-studio seam. C ends with the desk centre-right at about 60 % of frame height, like oilers' first frame, and the green floor pool keeps the dark frame from jumping into the bright classroom.
- Dropped: the eight-direction ring, the 1.3 s 360, lift down, the pylon and collision (ch 9 already shows the proximity stop).
- Built by `build-safety-chapter.py` (three sub-shots with `renderRange`, a new `render-cut.cjs` field), `join-subshots.py --transition fadeblack`.

## Sound
- The stretched pad is gone. `score-synth.py` has a `status` style (7 bars, Dmaj9 Bm9 Gmaj9 Em9 F#m7 Asus4, sparse kick, sparkle, no sonar). Only the 86.25-100.75 slot is taken from the regenerated score, with swells on both dissolve centres. The rest is HQ6's score (HQ4's movement textures kept), with 0.3 s crossfades on the bar lines (`build-safety-audio.py`).
- One cue: the app's `target_reached` chime at the green arrival (91.43 s, on the beat). It is a C5 sine, so it is pitched up 2 semitones to D5 to sit in the key. It plays about 8 dB under the music, and the music ducks 3 dB for 0.7 s.
- Short-term loudness across the slot: about -16 LUFS (HQ6 dipped to -21.6). Integrated -16.0 LUFS, true peak -1.9 dBFS.

## Ghost panel in the college room (Vico's 13-22-47 screenshot)
That frame is the coast>status dissolve (about 86.1 s in HQ6): the status chapter's tall red-trimmed desk fading in over the OCC desk. The raw coast render is clean, so it is not an overlap bug. In HQ7 that seam is a 1.5 s dissolve into a frame with the desk in the same spot.

## Reused
Chapters 1-5, 7-9, 12, 13 are symlinks to their HQ3/HQ4/HQ5 renders. New renders: 06 (three sub-shots), 10, 11.
