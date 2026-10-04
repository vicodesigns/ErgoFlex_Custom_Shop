# Standalone Music Mode and full effect gallery

2026-10-03. Implemented locally in `/home/ergo/ErgoFlex_Custom_Shop` by the
firmware-reference thread at the user's request. No desk commands, firmware changes,
microphone/screen capture, private file upload or website deployment.

## Try it

Hard-refresh `http://localhost:3000/product-demo.html`.
Expand **Music Mode · all music effects**, press **Start Music Mode**, then enable
**Hear music** if desired. Choose the original demo or **Your song** (local audio
file, maximum 100 MB), and switch effects without restarting the song position.
Use sensitivity, volume, pause, seek, repeat and stop controls.

The ordinary **LED effect** dropdown now includes all 28 decorative effect IDs
0–27, retaining the existing Solid/Breathe/Color cycle IDs and settings. Selecting
a decorative look via its dropdown ends Music/Game playback and shows that look.
The gallery includes Chase/Comet, Scanner, Meteor, Rainbow, Gradient, Fire,
Aurora, Pacifica, Candle, Fireworks, Elevator, Cascade and Height Sync.

## Music effects

All ten firmware-catalog music names are selectable: Spectrum 28, Pulse 29,
Comet 30, Strobe 31, Fire 32, Wave 33, Tower 37, Ripple 38, Bass Sky 39, Drop 40.
These are browser preview adaptations, **not byte-identical firmware output**.
Strobe is deliberately softened. No photosensitivity certification is claimed.

Web Audio analyses the ACTUAL selected audio through eight frequency bands and
RMS/beat metrics. It does not use the Game Mode clip's scheduled synthetic metrics.
Output gain comes AFTER analysis, so lights work while muted. User opt-in controls
audible music; it does not require microphone access. Blob URLs keep songs on this
device and are revoked on replacement/disposal. Oversized/non-audio files reject
without replacing the current source; playback errors are shown in the panel.

The bundled Music Mode audio is derived from the original owned Neon Flight clip,
with +9 dB source gain and MP3 encoding; measured average -17.0 dBFS, peak -3.2 dBFS.
The Game Mode video/soundtrack was not changed. Rebuild the audio with
`node tools/led/build-music-demo.mjs`. Visual output uses the existing RGBW atlas;
display-color mixing remains an approximation. Decorative algorithms likewise
use the firmware catalog's names/IDs but are software previews, not literal C++ ports.

## Integration behavior

- Diagnostics and actual movement/completion cues retain precedence over music.
- The song clock advances during movement; release shows the CURRENT audio response.
- Music and Game Mode controls explicitly end the other ambient owner on start.
- Base look/color/brightness remain separate from transient music state.
- Pause freezes the latest sampled pixels; paused seek clears stale pixels until
  playback resumes. Switching effects while paused re-samples cached metrics.
- Master LEDs off suppresses pixels; background hides pause the music and motion.
- Reduced motion pauses the source and uses a steady preview; no automatic restart.
- Page disposal stops media, disconnects audio nodes, closes the context and revokes
  local source URLs. Native AR export keeps the ordinary static material fallback.

## Files and validation

- `led-showcase-effects.mjs`: decorative catalog/samplers, music catalog/samplers,
  actual Web Audio metric adapter, bounded preallocated state.
- `led-music-mode.mjs`: media/analysis/gain lifecycle, local source, controls.
- `studio.js`: playback mounting, arbitration, background/disposal, console API
  `ErgoFlex.ledMusicMode`, decorative pixel sampling and full effect dropdown.
- `led-effects.mjs`: expanded valid settings without changing old base IDs.
- `assets/led/music/neon-flight-demo.mp3`: louder original audio-only demo.
- `tests/led-music-effects-test.mjs`, `tests/led-music-test.cjs`: sampler and browser
  checks. `npm run test:led-music` runs both.
- `divi-editor/build-site-upload.py` includes the new modules and existing LED
  assets folder; no package or site was published.

Existing LED effects, all 56 movement references, horizontal Game Mode correction
and Game Mode browser tests passed after initial integration. Music tests cover
all catalogs, actual muted analysis, volume, pause/seek, movement preemption,
Game exclusion, stop, invalid input, reduced motion and background cleanup.
Final local-song/demo browser regression PASSED, including private Blob source
playback and switching back to the demo. Mock Android AR regression also PASSED:
original controls, Glide/wheels, compass turning, pose controls, LEDs and repeated
sessions. New source/audio URLs return HTTP 200 from the running preview server.

PC2: preserve `led-game-frames.mjs`'s horizontal playback fix. This implementation
does NOT change physical strip calibration or any original Game Mode banks.
Future exact music parity requires native C++ fixtures/analyzer-normalization
matching; the current UI intentionally identifies these as previews.
