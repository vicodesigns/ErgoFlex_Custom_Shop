# Virtual desk LED integration — firmware handoff to PC2

Prepared 2026-10-03. Implementation ownership: PC2 owns Custom Shop browser files;
this thread owns firmware/API reference work. No physical desk commands, firmware
flashes, or changes to hardware safety behavior are required for the viewer.

## Verified sources and strip map

Source root: `/home/ergo/ErgoFlex_Desk_Stack/Polish-Features`.
Viewer root: `/home/ergo/ErgoFlex_Custom_Shop`.

The current Desk 02 configuration in `Firmware/ergoled_firmware/src/config.h:15`
has eight outputs and 106 addressable clusters, not 106 individual diodes.
`LEDS_PER_PIXEL` is 56. This is a desk-specific configuration, not a universal
Standard/Wide hardware specification. `/json/segments` returns IDs/names/pins/counts
from configuration (`src/api/WledApiHandler.hpp:275`), not rendered RGBW frames.

| ID | Firmware name | GPIO | Addressable count | Layer, top=0 |
| --- | --- | --- | --- | --- |
| 0 | Top Shelf Top | 27 | 14 | 0 |
| 1 | Top Shelf Bottom Back | 2 | 14 | 1 |
| 2 | Top Shelf Bottom Front | 33 | 15 | 1 |
| 3 | Second Shelf | 12 | 14 | 2 |
| 4 | Desk Top Center | 5 | 14 | 3 |
| 5 | Desktop Left | 25 | 11 | 3 |
| 6 | Desktop Right | 4 | 11 | 3 |
| 7 | Foot Rest | 15 | 13 | 4 |

Orientation facts: strips 5/6 run fore/aft; remaining strips run left/right.
Strip 4 is wired opposite its lateral neighbors. Firmware deliberately excludes
it from wheel comets. Patent labels are NOT wiring order: ID 1 is 822c, ID 2 is
822b (`EffectEngine.h:2182`). Do not reverse these based on older drawings.

Missing: absolute pixel-zero endpoints in GLB local coordinates, live/sacrificial
pixel visibility, and Standard/Wide electrical count differences. Configuration
comments identify sacrificial pixels and disagree with the updated left count;
use current array values for addressing, and do not infer visible counts from
those comments. Build a configurable per-strip visible-address mask. Wide mesh
stretching alone does not establish different electrical counts.

Viewer export indices in `Custom_Shop/docs/desk-led-engineering-brief.md` are mesh
indices, NOT pixel IDs. Base index 38 must be mapped to strip 7; desktop 0–2 to
4/5/6 after inspecting endpoints; shelf 39–42 to 0–3 after sequential diagnostic
identification. These are proposed associations until geometry is verified.

## Motion source of truth

`ergoflex_api/services/ergoled_native_anim.go:32` defines IDs 34 lift, 35 tilt,
36 wheels. Native path is opt-in (`ERGOLED_FW_NATIVE_ANIM`); legacy Go algorithms
also exist. Target current native algorithms explicitly, not stale file headers.
Host sets all segments on, segment/global brightness 255, palette 0, mirror/reverse
false, transition 5 units (500 ms), speed 160 for lift/tilt and 180 for wheels.

Colors from `services/led_status_indicator_service.go:30`:

| Event | Primary RGB | Direction/intensity |
| --- | --- | --- |
| Lift up | 0,0,255 | ix=0 |
| Lift down | 255,0,0 | ix=128 |
| Tilt extend | 255,255,0 | ix=0 |
| Tilt retract | 150,0,255 | ix=128 |
| All wheels directions | 255,0,0 | drive mode 1–10 |
| Wheel caution | 255,70,0 | col[2] |
| Target reached | 0,255,0 | solid, 5-second LED duration |

Host RGBW conversion sets W=min(R,G,B) WITHOUT subtracting W from RGB
(`ergoled_native_anim.go:332`). Keep raw values separate from browser RGB display
conversion; do not silently apply a conventional RGB-to-RGBW subtraction.
Final pixel setter (`EffectEngine.h:221`) scales each channel using `(channel*bri)>>8`,
then optionally applies gamma and configured hue trim. Music always enables gamma;
other effects enable it via segment `gc` (`:3030`). Transitions and power limiting
also affect final output. Algorithm-level colors are not final physical wire bytes.
Motion phase is shared per effect, incremented by unsigned elapsed milliseconds
(`:2027`), not eight independent clocks or one advance per strip. Phase starts at
zero only on first use; later reactivation includes elapsed time since last use.
Reset-on-start browser timing is reasonable but must be labeled as a parity choice.

### Lift, `EffectEngine.h:2055`

Five-layer circular wave. Speed Hz = .12 + sx/255*.28. Track length 5;
travel=phase*5. Up wavefront=(4-travel+5)%5; down=travel.
Circular layer distance=min(abs(layer-wavefront),5-abs(layer-wavefront)).
When distance<1, intensity=.5*(1+cos(distance*pi)); otherwise black.
Within a strip, multiply by 1-.15*pixel/max(count-1,1).

### Tilt, `EffectEngine.h:2098`

Speed Hz=.25+sx/255*.75. Angle=phase*2*pi+stripID*pi/14;
position=(sin(angle)+1)/2; reverse for ix>=128. Scanner center=position*(count-1).
Distance<=.5 is full intensity; otherwise max(0,1-(distance-.5)/1.5)^2,
cut off at distance>=2.5. Translate extend/retract using actual actuator behavior,
not the sign of the viewer's Euler angle alone: API describes extending toward
horizontal and retracting toward vertical (`led_status_indicator_service.go:3999`).

### Wheels, `EffectEngine.h:2126` and `:2306`

Comet speed Hz=.4+sx/255*1.1. Head=floor(phase*count)%count; reversed head=count-1-head.
Tail distance wraps opposite travel direction. Tail length=min(count,8), with
LUT [255,215,175,128,81,53,23,15]. Firmware tail brightness=(LUT*bri)>>8.
Caution uses synchronized (sin(2*pi*t*1.1)+1)/2, full-range brightness.
Forward/backward pulses use (1-cos(2*pi*t*.55))/2. Alternate red/amber on each
pulse boundary while dark; top/foot remain red on the same clock.

| Physical direction | ix | Strip choreography |
| --- | --- | --- |
| Strafe left | 1 | caution 1/4/5/6; comets 0/2/3/7 normal |
| Strafe right | 2 | same, comets reversed |
| Forward | 3 | comets 5/6 normal; red pulse 0/7; alternate pulse 1/2/3/4 |
| Backward | 4 | same, comets 5/6 reversed |
| Clockwise | 5 | caution 1/4; comet 5 reversed, 6 normal, other strips normal |
| Counterclockwise | 6 | caution 1/4; comet 5 normal, 6 reversed, other strips reversed |
| Left-forward | 7 | caution 1/4; lateral comets normal, wings normal |
| Left-backward | 8 | caution 1/4; lateral normal, wings reversed |
| Right-forward | 9 | caution 1/4; lateral reversed, wings normal |
| Right-backward | 10 | caution 1/4; lateral reversed, wings reversed |

Raw motor command != drive mode. Host map (`led_status_indicator_service.go:4903`):
command 1→ix9, 2→3, 3→7, 4→1, 5→2, 6→10, 7→4, 8→8, 9→6, 10→5.
Use physical direction names in browser events to avoid copying inverted opcodes.

## Arbitration, stopping, and restoration

LED priority ladder (`led_status_indicator_service.go:278`): E-stop 130,
thermal lockout 125, thermal warning 121, collision 120, proximity 118, OTA 115,
wellness awaiting 112, voice 100, all motor motion 60, autonomous preview 55.
Music and Game Mode claim 110. Current motion paths elevate to 114 while either
is active (`led_status_indicator_service.go:2587`), so movement DOES show over
them. The earlier base-rank-only conclusion was incomplete. Safety/OTA remain
above elevated movement; resume the current ambient stream when movement clears.

All motor axes share priority 60: most recently started axis wins, not wheels
always beating lift/tilt. Repeated frame ticks must not count as a fresh start.
Use revision/generation tokens so old stop timers cannot clear a newer effect.
Target LED is priority 60, green for 5 seconds, installed against expected revision
(`led_status_indicator_service.go:1303`); target audio is priority 61, 3 seconds.
Legacy wheels stop carries a documented 2-second post-stop hold near `:4943`.
Decide whether to retain it in preview and test it explicitly; E-stop bypasses it.

Store base effect independently from overlay. On stop/timeout remove only the
matching owner; recompute the active overlay/base rather than restoring a stale
color snapshot. User brightness and base-effect edits during movement must survive.
Viewer master off wins over decorative pixels; whether simulated safety cues can
override off is a UI policy that must be explicit, not a real desk safety setting.

## Real sound assets

Use `ergoflex_api/audio/safety_indicators/*.mp3` as canonical source; Flutter has
duplicates under `ergoflex_app/audio/safety_indicators`. Map from
`services/audio_safety_indicator_service.go:42`:

- lift_up → movement_lift_up.mp3; lift_down → movement_lift_down.mp3
- tilt_extend → movement_tilt_extend.mp3; tilt_retract → movement_tilt_retract.mp3
- wheels → movement_wheels.mp3; start → movement_start.mp3
- target → target_reached.mp3; collision → collision_alarm.mp3
- thermal_warn → thermal_warning.mp3; thermal_lock → thermal_lockout.mp3
- pending_action_request/preempted/cancel/countdown and safety_alert use same-name MP3s;
  check existence before adding a preview button, since host supports fallback.

The current checked source directory contains only the ten movement/target/collision/
thermal files listed above; pending-action and safety-alert filenames are service
map entries, not present bundled assets. Do not package broken references.

Verified lift-up encoding: MP3, 44.1 kHz stereo, duration 20.819592 seconds.
Do not assume all clips are short one-shot chimes. Loop sustained motion only while
its owner remains active; stop/fade on release/preemption; completion is a one-shot.
Start muted, unlock via gesture, handle play rejection, mute immediately, and stop
on hidden page/disposal. Copy only selected assets into public preview packaging;
never fetch a filesystem path or send a real desk playback command from the viewer.

## Music and capture

Current renderer dispatch (`EffectEngine.h:3061`): 28 Spectrum, 29 Pulse, 30 Comet,
31 Strobe, 32 Fire, 33 Wave, 37 Tower, 38 Ripple, 39 Bass Sky, 40 Drop. 34–36 are
movement, NOT music. FX 41 Ambient is a separate input-stream effect.
Audit each function and MusicConfig before claiming byte-identical music parity;
browser FFT alone does not reproduce host analyzer normalization/beat history.

Analyzer reference: `ergoflex_api/py_scripts/music_analyzer.py:48`, 44.1 kHz mono,
882-sample legacy or 441-sample low-latency windows. Eight Hz bands are
20–60, 60–150, 150–400, 400–1000, 1000–2500, 2500–5000, 5000–10000, 10000–20000.
`normalize():439` divides band magnitudes by the per-frame maximum and scales to
255; RMS volume uses int16 full-scale 32768. Do not feed Web Audio decibel bins
directly as these byte metrics.

Input contract (`services/music_mode_service.go:186`) is bands `b[8]`, volume `v`,
energy `e`, beat `bt`, bass beat `bb`, peak-band index `pk`, BPM `bpm`, beat phase
`bph`, packed bar position `bar`, envelope `env`, flags `fl` (build/drop/quiet),
centroid `sc`, tempo confidence `tcf`, spectral flux `flx`, timestamp `ts`.
All except timestamp are bytes; absent legacy structure metrics are zero. Layer
effects and Drop need these structure inputs; implement honest synthetic demo
metrics or full analyzer support rather than claiming every effect reacts correctly
from volume alone. Test stale audio/silence and beat rising-edge handling.

No general RGBW-frame download endpoint was found in the inspected API/diagnostic
sources. `/json/blanklog` only records unexpected-black episode metadata, not
pixel buffers (`src/BlankLog.hpp:7`). `/json/state` is configuration, not animation
frames. Do not poll either to record the actual light animation.

Recording choices:

1. Deterministic offline firmware-equivalent rendering from timestamped analyzer
   metrics, configuration changes, seed and effect clock (no desk required).
2. Opt-in developer capture of final post-transition/post-power-limit pixel buffer,
   with bounded buffered transfer separate from rendering/Show. This requires new
   firmware work and hardware testing; do not enable during ordinary operation.

Clip schema proposal: version, stripMapId, firmwareRevision, colorPipelineStage,
timebase, audioAssetId, audioOffsetMs, and timestamped RGBW frames. Seek from audio
currentTime, interpolate only with a documented policy, validate counts/size/
monotonic timestamps, and require rights-cleared audio for public showcases.
At 106 clusters RGBW is 424 bytes/frame (~12.7 KB/s at 30 FPS before overhead).
Recording music alone or photographing diffusers does not preserve raw pixel data.

## Browser contract and acceptance gates

Suggested boundaries:

- StripMap: version, physical ID/name/count, visible-address mask, local endpoints,
  parent rig, reverse flag, model-variant geometry references.
- MotionEvent: physical axis/direction, start/stop/target, owner generation, time.
- EffectSampler: config + elapsed time + input metrics + strip map → RGBW frame.
- OverlayController: priority + generation-based ownership; base state independent.
- PixelRenderer: updates preallocated texture/material buffers and local spill
  averages; no per-frame material cloning or one PointLight per cluster.
- SoundController: independent opt-in/volume, owner lifecycle, real asset manifest.
- ClipPlayer: validated frames, audio-clock sync, pause/seek/end cleanup.

Test sequential physical IDs/pixels, strip inversion, every direction, simultaneous
motion, release/cancel/limit/E-stop, completion only at true target, old-timer
immunity, edits during overlays, LEDs off, reduced motion, Standard/Wide rigs,
project import/export, AR export fallback, context recreation, audio denial/muting,
background/resume, and stable allocations. Capture reference screenshots before
shipping. Native USDZ/Apple export remains a static-state fallback unless separate
native LED animations are deliberately authored; do not claim browser-shader parity.

Saved physical endpoint calibration has now been located in
`/home/ergo/.config/ergoflex/strip_directions.json`; see
`docs/led-pc2-reference-answers.md` for its interpreted zero-endpoint table and
verified tilt-angle delta mapping. These supersede earlier missing-information
notes above. Game Mode integration is covered by `docs/led-game-mode-browser-handoff.md`.

Outstanding gates: confirm saved endpoints against GLB axes/visible counts, inspect
music input normalization, capture real reference clips, run mobile/AR visual QA,
and update public build packaging to include every new module and sound asset.
