# Awaken: the foot LED floor light at 7.5-9.5 s (brighter, saturated)

Vico's note (4K film, chapter 1 around 8 s): the footer light comes on but is too faint; it needs a focused section with a little
spill, more saturated, right on the ground. Base: origin/video/cinematic-intro-hq aaf6bb54. No epoch bump, nothing under exports/ changed.

## What awaken carried (3rd cut review-cut.json shot 0, 44.85 s)
No ledFloorGlow, no ledFloorSources, no floorLight. ledGlow 1, ledColor #767676 (a GREY LED), ledReceivers viewer (floorBounceStrength 130),
ledSurfaces floorStrength 39 / floorReach 4. ledStatus: off 0-7.45 s, then the default LED look, then lift-up (blue wavefront) from 10.4 s
(motion lift clip 10.4 s; the master's v5 had 9.25). So from 7.5 s the foot pool is the app's default: a weak grey strip under the footrest
(isolated by rendering with foot.on=false: contribution about 14 grey levels at its brightest, a hard-ish lower edge) next to the wide grey stage-light
pool. Because the LED is grey, saturation alone cannot colour it (mix(luma, rgb, k) of a grey is grey).

## The change
Data (importer doc awaken-foot-light-export.json = Vico's latest awaken importer export of the cut + shots[0].sceneGlobals.ledFloorSources.foot):
brightness x1 -> 2.6, saturation 1 -> 1.4, spread 1 -> 1.25, edge softness 1 -> 1.5, tint #2438ff amount 0 -> 0.8 (the lift-up blue that follows),
all KEYED, smoothstep: in 7.5-8.5 s, held 8.5-9.0, out 9.0-9.5 (keys in foot-keys.json; values equal the film's default at 7.5 s and from 9.5 s).
Code (opt-in; default unchanged): ledFloorSources spread/edge/brightness/saturation may be [[s, v], ...] (film-lighting.mjs clean, film-viewer-leds.mjs resolveFloorFields/setTime,
film-fx.mjs calls viewerLeds.setTime per frame); foot-only tint (#rrggbb) + tintAmount (keyable) in the foot shader (luma-preserving move toward the tint).
Test: tests/cinematic-floor-keyed-test.mjs (plain numbers clean/resolve exactly as before; keyed/tint cleaning; interpolation).
Pixel default check: a shot with ledFloorSources {foot:{brightness:1,saturation:1}} (param shader path) vs none: mean abs diff 0.005 at 8.5 and 9.5 s (noise).
Director: the importer (GLOBAL_FIELDS) carries ledFloorSources as is; the Director's floor-reflection editor uses plain sliders, so a keyed field shows as a number and
editing it flattens the keys (a keyed row / tint colour control would be new UI, not done).

## Numbers (1080p, real path: render-still hq13, college seed; box around the projected foot pool, +-0.7 m, brightest decile = the pool core; luma 0-1)
| s | luma before | luma after | p90 luma before | after | sat (brightest decile) before | after | frame mean diff |
|---|---|---|---|---|---|---|---|
| 6 | 0.0702 | 0.0702 | 0.2317 | 0.2317 | 0.1831 | 0.1831 | 0.01 |
| 6.5 | 0.081 | 0.081 | 0.2866 | 0.2866 | 0.1576 | 0.1576 | 0.01 |
| 7 | 0.0884 | 0.0884 | 0.3149 | 0.3149 | 0.1468 | 0.1468 | 0.009 |
| 7.5 | 0.1017 | 0.1017 | 0.3336 | 0.3336 | 0.1398 | 0.1398 | 0.007 |
| 8 | 0.2959 | 0.3089 | 0.3558 | 0.3884 | 0.136 | 0.2764 | 0.329 |
| 8.5 | 0.2649 | 0.2938 | 0.3521 | 0.4288 | 0.1139 | 0.4536 | 0.631 |
| 9 | 0.2348 | 0.2636 | 0.3521 | 0.4288 | 0.0784 | 0.4485 | 0.618 |
| 9.5 | 0.2357 | 0.2357 | 0.3521 | 0.3521 | 0.0694 | 0.0693 | 0.002 |
| 10 | 0.2556 | 0.2556 | 0.3521 | 0.3521 | 0.062 | 0.062 | 0.002 |

Outside 7.5-9.5 s (30 frames: 0, 2, 4, 6-10 every 0.5, 12-44 every 2, 44.8): frame mean abs diff 0.002-0.010 grey levels (render noise on this machine), identical luma/saturation;
7.5 and 9.5 s are unchanged too (keys at default). Inside, 2% of pixels change (max 88 levels), only at the pool. The three desk lights and the rest are untouched.

## Which chapters' keys change
chapter-keys.py on scratch copies of the 3rd cut (control = importer pass only; imported = doc + pass; previews/awaken-v5-cut.json made from each review-cut awaken shot, because
the key reads that file): only awaken changes (12 keys compared; measurements/keys-*.json). Importer on scratch copies: only review-cut.json (awaken sceneGlobals.ledFloorSources, directorEdited) and
director-camera.json (awaken lighting) differ (measurements/import-log.txt).

## Finding
The film renders awaken from previews/awaken-v5-cut.json (chapter-keys.py, render-request.sh), and the 3rd cut folder has none, so the freeze uses the MASTER's v5 (hq14; the render PC's copy
differs from the repo's, Nov 8) and NOT the cut's review-cut awaken. The doc only reaches the film if the cut also carries previews/awaken-v5-cut.json (importer apply_lighting writes it when present).

## Files
render/ (stills.sh, mkcut.py, design.py, probe-foot.js, measure.py, sheet.py; tools/experience/_foot-still.cjs is the gym still renderer + --probe), stills/ (before|after sheets, 8.0/8.5/9.0 s), measurements/.
