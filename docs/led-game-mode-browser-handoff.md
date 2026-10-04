# Game Mode — additional browser integration scope for PC2

User explicitly requested Game Mode on 2026-10-03. Add it alongside movement,
music and sound in the mock app / builder, not merely as a decorative preset.
PC2 owns viewer implementation; this document supplies verified source behavior.

## Existing feature, not a new invented effect

`ergoflex_api/services/game_mode_service.go` owns a 60 Hz heartbeat, capability
validation, latest picture keyframes, ambient-mode ownership and restore-on-end.
`ergoflex_api/py_scripts/game_capture.py` captures the chosen screen through
portal/PipeWire and runs `tools/game_mode_proto/ambient.py`'s color pipeline.
Firmware FX **41 AMBIENT** consumes AMBIENT_V1 frames and interpolates the strip
keyframes. It is different from ten music FX and ordinary whole-desk color cycling.

Prefer executable current sources over older rollout documents: the firmware
AMBIENT_V1 document still says it has never run on a board, but current service
comments/tests describe October 1 bench behavior. This audit does not establish
which firmware is installed now; the user reports the feature works.

## Customer preview experience

Add a **Game Mode** section with:

1. Start/stop a bundled rights-cleared gameplay-like or synthetic demo clip,
   displayed on the virtual monitor alongside its matching LED response.
2. Presets **Calm, Normal, Intense, Full** matching the physical feature.
3. Content **Colours** or **Colours + music**. Defaults: Calm/Normal colours;
   Intense/Full colours+music (`game_mode_audio.go:38`).
4. Preview volume/mute and optional movement sounds; do not autoplay sound.
5. Optional advanced per-strip sample-region/gain controls; keep wiring calibration
   in engineer diagnostics, not normal customer setup.

A second, optional interactive phase can accept user-selected local video.
Live screen capture requires explicit user gesture/consent, supported browser
capture APIs and separate permission/compatibility work; never silently capture
the desktop, call the desk's consent endpoints, or upload private video frames.
The builder must remain an offline simulation, not a real hardware control client.

## Reuse and pipeline

Reuse PC2's RGBW atlas and strip map. Feed it deterministic timestamped Game Mode
frames, preferably generated offline from the ACTUAL host/firmware algorithms.
Use the same clip timeline to drive monitor texture, LED pixels and optional audio.
Pause/seek/end must update all three together. Video capture colors/keyframes
alone are not final RGBW output: label the recorded pipeline stage explicitly.

Host pipeline source: `tools/game_mode_proto/ambient.py`, including `MODES:429`
and `Pipeline:712`. Full uses Intense dynamics bits but greater host exposure:

| Mode | Host target | Floor | Cap | Saturation | Board dynamics bits |
| --- | --- | --- | --- | --- | --- |
| Calm | .15 | .32 | .25 | 1.00 | 0 |
| Normal | .35 | .20 | .50 | 1.15 | 1 |
| Intense | .65 | .40 | .80 | 1.35 | 2 |
| Full | 1.00 | .60 | 1.00 | 1.35 | 2 |

These are PIPELINE parameters, not simple overall brightness percentages. Port
the actual transforms or use precomputed frames; do not multiply RGB by this table
and claim firmware-equivalent Game Mode. Per-strip role gains and calibrated
regions also matter. Saved Desk 02 regions/gains/directions are in
`/home/ergo/.config/ergoflex/strip_directions.json` (read-only reference).

Firmware `src/ambient/Ambient.hpp` implements linear interpolation, temporal
smoothing, audio fusion, RGBW separation, power gain, flash guarding and emit
quantization/dither. Do not run ordinary music-FX gamma over final ambient output
again. A browser display approximation must be identified as such; neither a
flash-guard port nor a preview establishes photosensitivity certification.

## Ownership and lifecycle

Standalone Music Mode and Game Mode are mutually exclusive in current service
logic; “Colours + music” is Game Mode's audio fusion, NOT enabling Music Mode
as a second LED owner. Switching modes should be explicit and restore correctly.
Both ambient owners have priority 110. Current movement effects elevate to 114
over either owner (`led_status_indicator_service.go:2587`); safety/OTA win above
that. On motion stop, resume the ambient pixels at the CURRENT media time.

Hardware state vocabulary: off, starting, waiting_consent, running, capture_lost,
needs_consent (`game_mode_service.go:87`). Bundled demo playback does not require
screen-capture consent, so do not show a fake consent prompt. Live capture should
handle denial, stream-ended, source loss and pause distinctly.

Firmware stream lease reference: LIVE <150 ms, HOLD to600 ms, FADE to2.1 s,
LOST holds25%; special hold requests are separate. Reproduce if claiming a live
stream simulation, but ordinary media pause should be a deliberate UI policy.
Keep base settings independent and do not persist transient game frames as the
user's saved look. Default-muted playback, master LEDs off, reduced-motion static
fallback, page-hidden/disposal cleanup and invalid-clip validation are required.

## Existing layout contracts useful for preview parity

`services/game_mode_layout.go:16` uses fractional **full uncropped frame** regions
`[x0,y0,x1,y1]`; corners clamp/order and minimum width/height is .02. Per-strip
gains are 0–100. Region/gain reset semantics are explicit in `LayoutUpdate:35`.
Real routes (`routes/game_mode_routes.go:213`) provide latest JPEG and layout
descriptor, but they are reference contracts only; public viewer must not require
a connected desk. An unavailable/private video must never be replaced with
cross-origin capture attempts without consent or permission.

## Acceptance gates

- Matching monitor image and LED timeline through play/pause/seek/repeat/end.
- All four modes and both content options; silent/black/static/scene-cut clips.
- Correct saved physical endpoints translated into GLB axes and visibility masks.
- Movement over Game Mode, most recent motor owner, safety preview priority,
  latest-frame resume and old-timer immunity.
- Explicit Game↔Music exclusion without changing base saved settings.
- No per-frame material allocations, giant unbounded frame arrays or new shadow lights.
- LEDs off, reduced motion, sound denial/mute and background cleanup.
- Standard/Wide preview, mobile performance and AR export static fallback.

This scope has been added to the shared handoff. Browser implementation and
hardware/device verification are still outstanding; no firmware or deployment
changes were made by the reference thread.
