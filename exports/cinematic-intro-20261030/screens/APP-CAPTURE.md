# Chapter 2 tablet: real ErgoFlex app capture

Real Flutter app (web build with the client-side virtual desk, `DEMO_API`), served read-only at
`http://127.0.0.1:4190/` (`build/web_live` of the demo worktree). No app source, build or server was touched.

## Deliverables

| file | size | notes |
|---|---|---|
| `02-tablet-app.mp4` | 2160×1440 (3:2), 30 fps, 17.0 s, H.264 yuv420p, GOP 15 | for `"target":"tablet"` (INVENTORY: tablet-pc panel is 3:2, 2160×1440 recommended) |
| `02-tablet-app-portrait.mp4` | 1440×2160 (2:3), same timing | portrait layout of the same screen |
| `app-stills/*.png` | full-res key frames at 0.5, 1.07, 3, 5, 6.6, 7.2, 9, 11.5, 16.5 s | both orientations |
| `app-capture-src/` | `run.sh`, `ctl.cjs`, `vclock.js`, `capture.js`, `compose.py`, configs, per-frame `*.timing.json` | reproduce or re-time |

## The screen

The app's home/controller ("shell"): header (ErgoFlex Desk, music, media, voice, camera, safety shield, red STOP),
the in-app 3D desk on the left (it rises and changes LED colour with the real desk: white at rest, yellow then blue while moving),
and the control column: GLIDE pad, **ERGO FORMS: Sitting / Drafting / Standing**, **HEIGHT** card with a big
`28.1 INCHES` readout (turns blue with an underline while moving), a hold-to-move slider and presets 28.0 / 35.0 / 43.0,
the **TILT** card, and Begin ♥ (wellness) / Position timer / Groove / LED. Portrait stacks the same cards under the 3D view.

Path in: login screen → **Start the live demo** → onboarding (Next, Skip, age 36–45, mobility Full, Next ×3, Done)
→ **Take me to my desk**. Before recording: tilt preset 0°, height preset 28.0.

## Performance and sync points (both clips, output time)

| t (s) | what happens |
|---|---|
| 0.00–1.00 | idle, readout **28.1″**, angle 0°, Position timer counting |
| **1.00** | touch 1 on the **Standing** ergo form (ripple overlay, contact up at 1.13 s) |
| **1.60** | readout starts climbing (28.1 → 28.2) |
| 1.6–6.07 | readout follows the 3D clip `comfortable-standing` (smoothstep): 29.4 @ 2.5, 35.8 @ 4.0, 40.3 @ 5.0 (expected 29.43 / 35.75 / 40.31) |
| **6.07** | readout reaches **43.3″** and stops (the app's Standing form is 43.3″ / −4.5°; the 3D desk ends at 43.5″ at 6.4 s, 0.2″ apart) |
| ~6.4–7.3 | the app's own toast "Restoring 'Standing' 43.3″ · −4.5°"; LED back to white, Position "0 s" |
| **7.00** | touch 2: press the HEIGHT slider thumb and drag it to the top (7.00–7.25), held |
| **7.40** | readout starts rising (43.3 → 43.5) |
| 7.4–10.6 | readout follows clip `full-height`: 44.3 @ 8.0, 48.0 @ 9.0, 51.7 @ 10.0 (expected 44.33 / 48.00 / 51.67) |
| **10.47** | readout reaches **52.5″** (52.45 rounds up; the 3D clip lands at 10.6) |
| **10.60** | finger lifts (release ripple), thumb springs back |
| 10.6–17.0 | idle at 52.5″; the Position timer counts up again from 0 s (to about 6 s) |

Every frame's readout is in `app-capture-src/02-tablet-app*.timing.json`. All sync points land within 0.2 s, or 0.2″ of the target.
Note: the brief said ~45.5″ for the first rise, but `shots/02.json` `motion.clips` says 43.5″, so the clips match the JSON.

## How it was made

1. **One local headless Chrome** (puppeteer-core, `--use-angle=swiftshader --enable-unsafe-swiftshader`), started only with
   ≥ 6000 MB available (`free -m`) and closed at the end. `ctl.cjs` is a tiny HTTP control server (vp/goto/click/eval/shot/run).
2. **Virtual time** (`vclock.js`, injected with `evaluateOnNewDocument`). Swiftshader takes about 1.3 s for each frame while the in-app 3D
   desk moves, so real-time capture can't work. The script replaces `performance.now`, `Date.now`, timers and `requestAnimationFrame`
   with a clock that runs normally until `__vc.freeze()`, then only moves when `__vc.advance(1000/30)` is called. Every frame is
   rendered fully, then screenshotted. The virtual desk, Flutter animations and the 3D viewer all run on this clock.
   It also pins the 3D iframe's `devicePixelRatio` to 1. Only the WebGL desk view is affected; the Flutter UI renders at 2×.
3. Viewport **1215×810 CSS at 2× DSF** (2430×1620), portrait **810×1215 @2×**. Downscaled with Lanczos to 2160×1440 / 1440×2160.
4. The demo-only "desk touchscreen" camera close-ups were switched off with the viewer's public runtime switch
   `iframe.contentWindow.ErgoViewer.screenCues(false)`. Otherwise the in-app camera flies to the desk's screen after a move.
5. Flutter semantics is enabled (`flt-semantics-placeholder`) so that each frame logs the **on-screen readout text**, not just
   `__efDesk.height` (the readout trails the pose by about 0.1″).
6. `capture.js`: 1.5 s idle, then tap Standing, step until the desk stops, 1.5 s idle, then press-drag the thumb up and hold until 52.5″,
   release, 8 s idle. The virtual desk moves at its own 0.9″/s (Medium).
7. `compose.py` **re-times by readout**. It does the same job as `setpts` per segment, but per frame and keyed to the displayed number.
   Idle segments play 1:1. The tap→motion-start gaps are stretched to 1.0–1.6 s and 7.0–7.4 s. During each rise, output frame *t* shows
   the first captured frame whose readout reaches `round(h(t),1)`, where `h(t)` is the 3D clip's smoothstep. Then it draws the touch
   overlay (a soft white contact disc that scales down slightly on press, an expanding blue-white ring on press and a fainter one on release,
   and for touch 2 a disc that follows the slider thumb) and encodes x264 CRF 14, `-g 15`.

Reproduce: `bash app-capture-src/run.sh` (writes to `/tmp/app-capture`, about 45 min with both orientations). If a dropdown click misses
during onboarding, finish that screen by hand with `curl -X POST localhost:4799/click -d '{"x":..,"y":..}'`.

Click targets (CSS px). Landscape 1215×810: Standing (1108,401), height thumb (942,576)→top 518, tilt 0° (1089,697), 28.0 (838,697).
Portrait 810×1215: Standing (650,1110), thumb (180,864)→top 752, 0° (688,1045), 28.0 (60,1045).
