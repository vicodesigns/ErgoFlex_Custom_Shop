# Capturing the cine cut's screen clips (stream S6, Nov 14 2026)

The clips are not in git (`exports/**/*.mp4` is ignored) and film renders freeze from the desk's checkout, so after
the merge the desk (`C:\work\ergoflex-cine`, Git Bash) captures them. Everything here is CPU only (headless Chrome with
SwiftShader); one clip at a time is fine on a 12 GB machine (one Chrome page plus one ffmpeg, about 1 GB). Only the
optional twin video in step 1 uses the GPU.

Every cine clip is defined in `tools/experience/screens/clips.mjs` (the `cine-*` entries). It samples its chapter of
`exports/cinematic-intro-cut-cine/review-cut.json` by id, is chapter seconds + 1 s long (the office finale clips:
10 s), and is written to `exports/cinematic-intro-cut-cine/screens/<id>.mp4` (the floor plan is a `.png`). After a
chapter's owner changes its desk moves, re-capture that chapter's clips: the readouts follow the cut.

## Order

```bash
cd /c/work/ergoflex-cine
# 0. the cut points at the clips (only the screens fields; coast only when named, after S4)
python exports/cinematic-intro-cut-cine/build-screens.py
python exports/cinematic-intro-cut-cine/build-screens.py --only coast

# 1. awaken: the twin card's real 3D desk, from the cut's own awaken moves (GPU render, optional:
#    without TWIN the card draws the 2D side view). The render server must be running (render-server.cjs 3017).
TWIN_SOURCE=exports/cinematic-intro-cut-cine/review-cut.json TWIN_OUT=exports/cinematic-intro-cut-cine/post/twin-cut.json \
  python tools/experience/build-round8-twin.py
node tools/experience/render-cut.cjs --cut exports/cinematic-intro-cut-cine/post/twin-cut.json --shots 0 --video \
  --size 1472x640 --out exports/cinematic-intro-cut-cine/post/twin            # -> post/twin/01.mkv
TWIN=exports/cinematic-intro-cut-cine/post/twin/01.mkv node tools/experience/screens/capture.mjs cine-awaken-main

# 2. every other chapter, one clip per process (the id prefix selects: cine-rise, cine-create, ...)
for id in cine-rise-portrait cine-rise-curved \
          cine-create-landscape cine-create-portrait cine-create-floor-plan \
          cine-commons-reservation \
          cine-oilers-curved cine-oilers-portrait cine-oilers-laptop \
          cine-wellness-main cine-wellness-tablet \
          cine-awareness-main \
          cine-storage-phone \
          cine-hero-gaming cine-hero-artist cine-hero-hbhs cine-hero-occ cine-hero-home cine-hero-office-wide cine-hero-office-portrait \
          cine-coast-main cine-coast-curved cine-coast-portrait cine-coast-wall; do
  node tools/experience/screens/capture.mjs $id || break
done

# 3. music: the beat and the spectrum come from the cut's own score (S7), read at capture time: the chapter's start
#    from exports/cinematic-intro-cut-cine/edl.json, the spectrum from score/score.wav (generated, untracked: build the
#    score first), the beat list from score/tempo-map.json chapters.music (beats_rel from music_from). Re-capture after
#    every score rebuild.
node tools/experience/screens/capture.mjs cine-music
#    (it prints the tempo it used, e.g. "23 beats from 0.825 s, ~112.941 BPM"; no score.wav: no spectrum, beat kept)

# 4. check: fails on a missing clip or one shorter than its chapter, and on a clip the freeze list does not carry
python exports/cinematic-intro-cut-cine/check-screens.py --freeze
```

Tempo map (read by `scenes/ch09.js` as `SHOT.tempo`): S7's `tempo-map.json` (`chapters.<id>.beats_rel`, counting from
`music_from`; a pickup beat before it is not counted), or with `CINE_TEMPO=<json>` either that format or
`{"bpm": 120, "first": 0.75}` / `{"beats": [...], "in": "film", "chapterStart": <s>}`. The BPM chip, the beat pulses,
the arcade's pickups and the macro-key chase follow the beat list (so a tempo change at a cut is followed).

Environment variables: `CINE_CUT` (another cut file), `CAPTURE_SHOT` (a cut or shot file), `CAPTURE_OUT` (another
output folder), `TWIN`, `CINE_TEMPO`, `CINE_SCORE` + `CINE_SCORE_START`, `PYTHON` (default `python` on Windows),
`CHROME_PATH`. `--stills 0,4,8 --still-dir <dir>` writes PNGs instead of a clip.

## Clips the cut references

See the table in the S6 report and `node tools/experience/screens/capture.mjs --list`. All of them are listed in
`tools/experience/freeze-lists/win-exports.txt`.

## Capture time (CPU, this machine, one clip at a time)

Measured by S6 on Nov 14 (Ryzen desktop, headless Chrome with SwiftShader, one clip at a time; seconds of capture.mjs,
an upper bound where a lock wait is included). About 20 minutes for all 29 clips; memory stays near 1 GB.

| clip | size | length | capture |
|---|---|---:|---:|
| cine-awaken-main | 2560x1072 | 45.9 s | 131 s (+ the twin video decode with TWIN) |
| cine-rise-portrait / -curved | 1080x1856 / 2560x1072 | 19 s | ~45 s / 53 s |
| cine-create-landscape / -portrait | 1920x1120 / 1080x1856 | 24.5 s | 39 s / 39 s |
| cine-create-floor-plan (png) | 1600x1000 | still | 1 s |
| cine-commons-reservation | 1920x800 | 17 s | 35 s |
| cine-coast-main / -curved / -portrait / -wall | 1920x1120 / 1920x800 / 1080x1856 / 3840x1520 | 15.5 s | 25 / 28 / 34 / 55 s |
| cine-oilers-curved / -portrait / -laptop | 1920x800 / 1080x1856 / 1280x776 | 15 s | 31 / 24 / 20 s |
| cine-wellness-main / -tablet | 1920x1080 / 1620x1080 | 17 s | 45 / 34 s (the main decodes the demo clip once) |
| cine-awareness-main | 1920x800 | 13 s | <= 78 s |
| cine-music-tv / -arcade / -marquee / -streamdeck | 1920x1080 / 1360x1080 / 1920x504 / 960x616 | 13.5 s | 23 / 20 / 20 / 17 s (+ the montage decode once) |
| cine-storage-phone | 540x1160 | 26 s | 34 s |
| cine-hero-gaming / -artist / -hbhs / -occ / -home | 1920x800 | 49 s | ~98 s each |
| cine-hero-office-wide / -portrait | 2560x1072 / 1080x1856 | 10 s | 28 / 22 s |

The music spectrum needs numpy for `audio-bands.py` (not installed on this Windows Python: the clips are then captured
without a spectrum, the beat still from the tempo map; `pip install numpy` gives the equaliser the real score).
