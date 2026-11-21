# Screen light: verification (21 Nov 2026)

Branch `eng/screen-reflection` (base `video/cinematic-intro-hq` c4a2becb). Contract: `CONTRACT.md` (also on
`cut/screen-reflection-contract-20261121`). All renders on the Win render PC (RX 6900 XT, ANGLE D3D11), under the GPU lock
(`gpuretry.sh`), `tools/experience/render-cut.cjs` stills (960x540 JPEG, every 0.5 s through ch 9 and ch 10 of
`exports/cinematic-intro-cut-vicos-3rd-cut`), `render-still.cjs` 1920x1080 PNGs, and 854x480 clips (`--video`).

## 1. What the screen light is, and what was washed out

The coloured light from the screens on the desk, floor and walls in ch 9 / ch 10 is the desk LED light in `ledMode: 'media'`
(film-fx `makeLed` / `sampleLed`, the app's Game Mode path): the screen clip is sampled per strip pixel
(`led-screen-sampler.mjs`, linear light, x the `full` preset), x `ledGain`, clipped per channel at 255 and uploaded to the
strips, the desk receivers (`ledSurfaces`: desktop underside 165-200 of 200, floor 162-200, base) and the room LED spill;
the picture's mean colour also becomes the LED colour. There is no separate screen-to-room light (the gaming / music rooms'
"screen light" pools are fixed colours, not the picture), and bloom is off in both chapters (`quality.bloom: false`).

What the base frames show (`C:\work\refl\base`, sheets `09-sheet.jpg` / `10-sheet.jpg`):
- ch 9 (gaming room, black desktop): the desktop top is lit into pale cream / white streaks under the monitor (3.0 s, 9.0 s,
  10.5-12.5 s: almost white with a pink-violet right wing); the floor pool under the desk is a pale yellow-white
  (5.5-8.5 s). The montage's pictures are mostly pale (sky, grey street), so the light is bright and nearly colourless.
- ch 10 (movie night, `ledGain` 3.15): the desktop shows hard colour bands with a near-white centre band (the white suit,
  14-17 s), the drawer front below the keyboard tray takes the same stripes, the floor pool on the rug is a bright
  warm-white patch (0-9 s). At 3.15x most bright samples have one channel past 255; per-channel clipping turns them toward
  white (orange (200, 80, 20) x 3.15 -> (255, 252, 63)).

## 2. Defaults = unchanged pixels

The code path is literally today's arithmetic when `sceneGlobals.screenLight` is absent / `{}` / all defaults
(`led.light === null`); chapters without `ledMode: 'media'` never build the LED sampler, so the field is ignored there.
Frame differences (`measure.py --diff`, all frames, 0-255 levels):

| comparison | frames | mean abs diff | max |
|---|---|---|---|
| ch 5 coast: base code vs new code | 15 | 0.270 | 26 |
| ch 5 coast: base vs new code with `screenLight {gain .5, saturation 2, tint #ff0000}` (ignored: not a media chapter) | 15 | 0.273 | 30 |
| ch 9: base vs new code (no field) | 26 | 0.259 | 25 |
| ch 9: base vs `screenLight: {}` | 26 | 0.257 | 24 |
| ch 10: base vs new code (no field) | 35 | 0.171 | 29 |
| ch 10: base vs `screenLight: {}` | 35 | 0.172 | 31 |
| **noise floor**: two renders of the same code and data (ch 9 / ch 10 new code vs `{}`) | 26 / 35 | 0.259 / 0.172 | 28 / 28 |

The identity comparisons sit exactly at the machine's repeat-render noise (mean ~0.2 levels; the max of ~25-30 is a few
isolated JPEG / shading pixels in every pair, including two renders of the same thing). No render epoch bump needed.
`chapter-keys.py` per chapter before/after this branch: only **music (ch 9)** and **media (ch 10)** keys change (their
shot data gained `sceneGlobals.screenLight`); rise, create, commons, coast, oilers, wellness, awareness, storage, hero
keys unchanged (awaken's key could not be computed in the 3rd cut: it has no `previews/awaken-v5-cut.json`; its shot is
untouched).

## 3. The chapter defaults (data, ch 9 and ch 10 only)

Explored on scratch copies of the cut (same frames, metrics over the screen-lit area, see below):

| ch | variant | luma | saturation | chroma | >235 |
|---|---|---|---|---|---|
| 9 | before | 77.0 | .386 | 34.2 | 1.0 % |
| 9 | v1 gain .7 sat 1.3 | 68.4 | .439 | 35.9 | 0.6 % |
| 9 | v2 gain .6 sat 1.4 keepHue | 65.0 | .454 | 35.6 | 0.5 % |
| 9 | v3 gain .75 sat 1.25 contrast 1.2 keepHue | 71.5 | .428 | 35.4 | 0.8 % |
| 10 | before | 72.9 | .462 | 38.1 | 0.5 % |
| 10 | v1 | 65.0 | .553 | 44.0 | 0.1 % |
| 10 | v2 | 59.8 | .579 | 44.7 | 0.1 % |
| 10 | v3 | 60.7 | .560 | 42.1 | 0.2 % |

Applied (review-cut.json and director-film/<id>.json of the 3rd cut):
- ch 9 music: `sceneGlobals.screenLight = {gain: .55, saturation: 1.5}` (its `ledGain` is .77, so keepHue does nothing there)
- ch 10 media: `sceneGlobals.screenLight = {gain: .6, saturation: 1.4, keepHue: true}`

## 4. Before / after (final data, real renders)

Metric area: pixels the screen light brightens by > 10 levels in the base render (base vs a `gain: 0` render); every
0.5 s frame that has such an area (ch 9: 26 of 26, ch 10: 35 of 35). Luma = Rec.709 on sRGB levels; saturation = HSV S;
chroma = max - min channel; per frame in `measurements.json`.

| ch | | mean luma | screen light's share of it (luma - no-light luma) | saturation | chroma | pixels > 235 |
|---|---|---|---|---|---|---|
| 9 | before | 77.0 | 40.7 | .386 | 34.2 | 1.0 % |
| 9 | after | 63.3 | 27.0 (-34 %) | .463 (+20 %) | 35.6 (+4 %) | 0.5 % |
| 10 | before | 72.9 | 47.7 | .462 | 38.1 | 0.5 % |
| 10 | after | 59.8 | 34.7 (-27 %) | .579 (+25 %) | 44.7 (+17 %) | 0.1 % |

(no light at all: ch 9 36.3 / .554, ch 10 25.2 / .703)

Looking at the frames: ch 10's desktop bands keep their colour (reds, teal, orange read as colours, the white-suit centre
band is a narrow warm highlight instead of a wide white one), the drawer front and the rug pool are dimmer and redder.
ch 9 is the smaller change: the desktop is darker and slightly warmer, but where the montage picture itself is pale
(the sky level at 3 s, the grey street at 9 s) the light stays pale: saturation cannot add colour the picture does not
have. Lower `gain` (Brightness) is the stronger lever there.

Files on the desk (push.sh): `refl-ch09-sheet-before-after.jpg`, `refl-ch10-sheet-before-after.jpg` (every 0.5 s, pairs),
`refl-still-ch09-t0.24.jpg`, `refl-still-ch09-t0.72.jpg`, `refl-still-ch10-t0.235.jpg`, `refl-still-ch10-t0.824.jpg`,
`refl-still-ch10-t0.882.jpg` (1920x1080 before over after), `refl-ch09-clip-before-left-after-right.mp4`,
`refl-ch10-clip-before-left-after-right.mp4` (480p), `refl-variants-ch09.jpg`, `refl-variants-ch10.jpg` (base / v1 / v2 /
v3 / no light), `refl-coast-identity.jpg`, `refl-measurements.json`.

## 5. Director round trip

`tests/screen-light-import-test.py` (scratch copy of the 3rd cut in the temp folder, chapter 10): an export with
`sceneGlobals.screenLight {gain .6, saturation 1.4, contrast 1, tint '#FFF0E0', keepHue true}` -> `director-camera-media.json`
`lighting.screenLight {gain .6, saturation 1.4, tint '#fff0e0', keepHue true}` -> the pass writes the same into the film
shot's `sceneGlobals`; an export without the field keeps it; `{}` removes it; no other field of the shot changes.
`import-roundtrip-example.json` is that run's log. `tests/screen-light-test.mjs`: the maths, the cleaner, `cleanLighting`
carrying the field (and `{}`), film-fx keeping today's arithmetic for the default.

## 6. Not verified

- The Director UI itself (the `ui` session's controls), the live in-place update in the Director's stage (film-fx
  `update()` on a `screenLight` change) and Render still from the Director: not run in a browser here.
- The 4K / film-render path (render-cut `--video` at 1080p/4K with `--blur`): only 480p clips; the LED easing on video is the
  same code (the clips show it), but no 4K frames were made.
- Tint and contrast were exercised in node tests and one render variant (contrast 1.2), not as a visual sweep; tint not
  rendered at all.
- The chapter defaults were picked by me from metrics and stills, not by Vico.
- `tests/screen-look-test.mjs` fails on this base (`assert.ok(end>0)`) before and after this branch; not investigated.
- chapter 1 (awaken) cache key not computable in the 3rd cut (missing preview file); its data is untouched.
