# Live media sharing — 10 October 2026

## Use it

Open the viewer in desktop Chrome or Edge at localhost or HTTPS.

1. Open **LED → Game Mode** (controller icon).
2. Click **Share tab or screen** and choose a browser tab, a game/application window, or your other display.
3. For audio too, enable the audio checkbox offered by the browser and select **Colours + music** in the viewer.
4. Keep the viewer visible on your first display and the source on your other display. The desk's temporary monitor shows the shared picture; the LEDs and their existing surface reflections follow its colours.
5. **Pause** holds the picture and lights; **Stop** releases sharing. **Change shared source** opens a fresh picker. **Use demo clip** returns to the original synchronized demo.

For audio-only Music effects and Auto DJ, use **Music → Live → Use computer audio**. On phones or browsers without screen capture, use the microphone, an audio file, or the demo. Audio sharing depends on the selected source, browser and OS. Sharing a Chrome tab is generally the simplest way to include audio; selecting an entire display does not guarantee system audio.

No stream is uploaded, recorded or included in project files. Browser consent is requested on every new sharing session. Restoring a Groove remembers the source type/settings and asks the user to reconnect, without opening the picker automatically. Switching between live screen and standalone Music retains their existing single-owner behaviour. Existing collision/movement cues take priority over ambient colours.

## Implementation

- `led-game-mode.mjs`: capture lifecycle, picker invoked directly in click event, VideoTexture and preview monitor, optional AudioContext RMS analysis, cancellation/source-ended/navigation/disposal cleanup. Audio is analysed without routing it to speakers, avoiding a second playback copy. The preview video is always muted for live capture. Missing audio falls back explicitly to colours only.
- `led-screen-sampler.mjs`: 160×90 readback, approximately 12.5 samples/second, spatial averaging, sRGB-to-linear conversion, 150 ms temporal smoothing. Eight strip paths use the actual geometry's electrical directions. Horizontal strips sample successive screen bands; the desktop wings use left/right screen edges. This does **not** apply the offline demo's mirror/swap correction.
- Live output is a **browser lighting approximation**, not firmware Ambient.hpp parity. Live presets provide brightness gains .25/.5/.8/1; optional captured audio modulates the same colours with RMS energy. This is not the firmware's keyframe interpolation, audio fusion or person-colour gamma path. The existing firmware-derived demo banks are unchanged.
- Linear RGB bytes enter the existing Game Mode renderer path; the synthetic white channel is zero. Existing LED reflection receivers continue to consume the uploaded pixel texture.
- Reduced motion samples one picture and holds it. Backgrounding the viewer holds playback; returning requires Play. Navigation/pagehide releases capture, including BFCache. Stop clears the canvas and sampled frame buffers.
- Monitor content fits its screen without stretching different source aspect ratios. Monitor objects remain transient and excluded from exports.
- `studio.js`: integration into lighting ownership, temporary monitor, per-desk/Groove recipe source type and pagehide cleanup.
- Site upload builder includes the new sampler. Root Store/Studio and desk-only entrypoints load the new version; previously generated ZIPs are not changed by this source update.

## Verification

- `node tests/led-screen-sampler-test.mjs`: screen region directions, preset gain, audio response and black-screen behaviour.
- `node tests/led-screen-capture-test.cjs`: synthetic canvas MediaStreams and oscillator audio; click activation, optional audio/no-audio, pause/cap, cancellation, ended tracks, late picker resolution, reduced motion, demo switch, full hospital viewer LED upload, monitor, saved Groove reconnect and BFCache cleanup.
- `node tests/led-game-test.cjs`: existing synchronized demo, preset/content/audio controls, motion overrides, export fallback, geometry reuse and cleanup.

These automated tests use synthetic streams. The user's operating-system picker and actual second display must still be exercised manually.

Browser references: https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getDisplayMedia and https://developer.chrome.com/docs/web-platform/screen-sharing-controls
