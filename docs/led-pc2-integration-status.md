# PC2 LED integration status

October 3, 2026. Browser implementation in the Custom Shop; firmware remains unchanged.

## Shared handoff received

PC2 read the complete movement/music/sound audit, Game Mode scope and reference
answers. Shared files let the lanes coordinate while direct chat is writer-locked.

## Implemented in the browser

- Eight-strip RGBW atlas, localized receiver spill and engineer address diagnostics.
  Existing meshes are sufficient; no manual pixel-section modeling is required.
- Solid, Breathe and Color cycle remain the saved base look.
- Lift 34, tilt 35 and all ten wheel direction cues 36 follow actual pose changes.
  Movement interrupts Game Mode; release resumes its **current video time**.
- Latest-started moving axis owns the cue. Same-frame ties resolve lift, tilt,
  then wheels; no pending timer can erase a newer owner.
- Preset lift/tilt completion displays green for five seconds. Jog release, Stop,
  stationary travel limits and hidden-page cleanup do not invent completion.
- Real movement/start/target MP3 assets are available through **Movement sounds**,
  disabled by default. Motion loops stop on release, preemption, Stop or background.
- **Game Mode & movement** controls: original Neon Flight clip, Calm / Normal /
  Intense / Full, Colours / Colours + music, Play/Pause, Stop, Repeat and seek.
  Calm/Normal default to Colours; Intense/Full default to Colours + music.
  Audible demo music requires the separate **Hear demo music** checkbox.
- One video timeline drives the virtual monitor, LED bank and optional soundtrack.
  Reduced motion pauses a static preview. Base settings survive all transient cues.
- Glide controls now use fixed floor axes: down/front, up/back, left/right stay
  consistent after camera orbit or desk yaw. In Android AR this is the original
  placement frame. Physical wheel LED direction still follows actual desk-local
  movement. The user requested reversing rotation comet travel after visual testing;
  the preview reverses that trail only, preserving direction IDs and desk motion.

## Frame provenance

Movement sampler matches all **56 source-derived reference frames** byte for byte
with the visual rotation correction disabled. This proves agreement with that JS
reference stage, not a physical capture or C++ float32 golden test. Movement output
is post-channel-brightness, before gamma/transitions/current limiting. Preview
motion starts its phase at activation; firmware can retain a shared phase. Wheel
release restores immediately; the hardware legacy two-second hold is not simulated.

Game Mode's eight bounded banks were generated from the actual host `ambient.py`
and compiled board `Ambient.hpp`. They include interpolation, temporal smoothing,
audio fusion, RGBW separation, power gain, flash guard and dither/emit stages.
The source hashes and precise stage are in `assets/led/game/manifest.json`.
The original video and synthesized soundtrack use scheduled synthetic audio
metrics, not microphone analysis or captured ESP32 frames. Raw linear RGBW drive
is converted once for the atlas; combining W into display RGB remains an approximation.

No live screen capture, private video upload, desk transport or real hardware
command is involved. Standalone Spectrum/Pulse/Comet music effects and other
music effects remain a later integration; Colours + music is Game Mode audio
fusion, not a second standalone music owner. Safety sounds/effects are not wired.

## Mapping evidence and remaining engineer checks

Saved October 1 operator calibration now seeds physical address-zero directions:
IDs 0/1/2/3/7 user-right; ID 4 user-left; IDs 5/6 back. These translate to the
current CAD axes and still require a current sequential hardware/geometry check.
Desk 02 counts are `[14,14,15,14,14,11,11,13]` (106 clusters, 56 LEDs per cluster).
They are not asserted to be both desktop sizes' electrical BOMs.

Addresses remain intact and provisionally visible. Sacrificial zero addresses on
2/5/6 and strip 7 address 12's historical dead status are documented, but current
visibility/repair status is unknown. Please confirm before applying a visible mask.

## Verification

- `node tests/led-movement-test.cjs`: 56 reference frames, ten wheel directions,
  reversed rotation preview, actual-delta ownership, release/completion/timer safety,
  default-muted audio lifecycle and all eight Game Mode bank sizes/stages.
- `node tests/led-game-test.cjs`: browser play/pause/seek/repeat/end, four presets,
  both content modes, muted audio, lift/tilt/glide preemption and current-time
  restoration, master off, desktop-size allocation reuse, native export exclusion,
  reduced motion/background cleanup and fixed floor directions after orbit/yaw.
- Existing LED pixel and base-effect browser regressions pass.
- `node tests/product-ar-test.cjs --app-only`: repeated mock Android AR sessions
  pass, including reused Game Mode controls, fixed floor Glide, wheel spin, tilt,
  lift, LED settings and restoration of the prior renderer/DOM state.
- Native exports omit browser pixel shaders and the temporary video monitor;
  ordinary configured materials remain the Apple/static fallback.

Physical device visual parity and mobile performance profiling remain separate
checks. The changes are local; no website upload was performed in this milestone.
