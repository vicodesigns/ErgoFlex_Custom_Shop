# Flutter visualizer: answers to the five engineering questions

6 October 2026. Checked against the delivered browser release and the local firmware/API implementation. These clarifications supersede any broader interpretation of the original handoff. No app or firmware implementation was changed.

## 1. Music effects and live metric conversion

**The browser effects are independently implemented preview adaptations, not literal ports of the firmware effects.** Their names and FX IDs match the catalog: 28–33 and 37–40. IDs 34–36 are movement effects. In particular, the browser softens Strobe and slows Comet; its Spectrum controls also differ from firmware. Label output driven by these samplers as an **approximate live preview**.

The authority for hardware behavior is [EffectEngine.h](native-source/Firmware/ergoled_firmware/src/EffectEngine.h), including `fxMusicSpectrum`, the other `fxMusic*` functions, `readSmoothedAudio`, shared per-frame state, and `renderFromState`. [MusicConfig.hpp](native-source/Firmware/ergoled_firmware/src/state/MusicConfig.hpp) and the palette engine are part of that behavior. Matching only effect numbers cannot reproduce firmware tuning, color drift/bursts, structure-aware Drop, gamma, or timing.

For an adapter to the existing browser sampler, use this **recommended conversion**, bypassing the Web Audio analyzer:

```js
const unit = v => Math.max(0, Math.min(255, Number(v) || 0)) / 255;
const metrics = {
  bands: packet.bands.map(unit), // low to high; retain the eight-band order
  volume: unit(packet.volume),
  energy: unit(packet.energy),
  beat: packet.beat === true,
  bassBeat: packet.bass_beat === true,
};
```

Do not divide the incoming bands by their frame maximum, multiply volume by four, run dB conversion, or apply local microphone sensitivity again. Those operations belong to `analyseMusic`'s local-audio measurement path. Re-normalizing an already scaled live frame would make quiet bands look full-strength. Preserve `energy` separately from `volume`; the local analyzer happens to equate them, but live telemetry does not need to.

The reviewed service uses an 80 ms minimum broadcast interval, approximately 12 Hz. Update the latest continuous values on arrival and render the browser sampler at the display cadence. Optional display interpolation is an appearance choice, not a firmware-equivalence claim.

**Beat flags must be consumed as events.** Each new accepted telemetry packet with an OR-aggregated true flag contributes one pending event, consumed on one render tick. Do not leave true asserted throughout the approximately 80 ms interval: `MusicSampler.sample` toggles Comet direction every call with `bassBeat`, and resets Pulse/Drop envelopes when flags are true. Do not require a false packet between two true packets; they may represent separate beats in adjacent aggregation windows. Suppress duplicate packets using available ordering metadata or local receipt identity. On stale input clear pending events and fade/hold according to an explicit preview policy. The coalesced feed loses within-window event count/timestamps, so exact board timing cannot be recovered from it.

Browser authority: [MusicSampler and analyseMusic](browser-reference/led-showcase-effects.mjs). This adapter is a recommendation; it has not been added to the app.

## 2. Firmware palette numbers

**`led-custom-presets.mjs` does not contain the complete firmware built-in palette table.** It validates/samples supplied palette definitions and implements the basic paths for palette 0 (segment color), 20 (two colors), and 21 (three colors). The nine delivered user definitions live in [led-saved-library.mjs](browser-reference/led-saved-library.mjs). Some saved recipes also embed resolved fixed definitions for firmware palette IDs **1 and 11**. These are not a general numbered lookup for every live palette.

For live state port [PaletteEngine::colorFromPalette](native-source/Firmware/ergoled_firmware/src/PaletteEngine.h), its data table, and [UserPalette::sample](native-source/Firmware/ergoled_firmware/src/palette/UserPalette.hpp):

| Firmware ID | Meaning |
| --- | --- |
| 0 | `seg.col[0]` pass-through |
| 1–19 | Fixed 16-stop RGBW palettes in `PaletteEngine.h` |
| 20 | Dynamic two-color segment gradient |
| 21 | Dynamic three-color segment gradient |
| 22–29 | Current user palette slots; fetch the actual live slot definitions |

Preserve `pblend`: fixed stepped mode rounds to the nearest stop, smooth mode uses the firmware's integer interpolation. User slots have their own blend mode. Port `musicPalPos` as well when reproducing Music's user-palette spread. Nine saved definitions do not identify the current contents of eight live slots. Unknown definitions should be reported as unresolved rather than assigned an unrelated palette.

## 3. Six Game keys, spreading, and the gamma path

**There is no JavaScript port of `Ambient.hpp` in the delivered browser.** [sampleGameBank](browser-reference/led-game-frames.mjs) only reads already rendered RGBW banks and interpolates between their time frames. The build tool compiled the actual C++ pipeline to generate those banks.

For just the spatial spreading step, port **`Ambient::interpolateKeys` and `Ambient::srgbToLin`** in [Ambient.hpp](native-source/Firmware/ergoled_firmware/src/ambient/Ambient.hpp). For each strip of N addresses and K keys (the API currently supplies six):

1. Decode every key channel from sRGB byte to linear light, using the standard piecewise sRGB transfer function.
2. For physical address p, calculate `x = p * (K - 1) / (N - 1)` (zero for N=1).
3. Interpolate the two surrounding **linear** keys, preserving endpoints and physical address order.

Do not interpolate sRGB bytes directly. Do not apply host/region gains again to `sent_keys`: the keys already contain the host gain. Brightness/output caps applied later by the board are separate from that host gain.

**For complete board-output parity, stage 1 alone is insufficient.** Port the `accept → step → emit` stateful chain: timing and leases, temporal filtering, scene-cut handling, optional fresh audio fusion/stereo, RGBW extraction, power gain, flash guard, effective brightness, temporal dither, and minimum-on hysteresis. Output also depends on the board's current effective power ceiling and brightness; the fixture's brightness 255 and 8000 mA are not universal live settings. Without all relevant inputs, describe reconstructed output as approximate.

The “person-colour gamma path” needs a precise distinction: the API activation sets `gc:true`, but **FX 41's `EffectEngine::fxAmbient` calls `Ambient::emit` and writes `SetPixelColor` directly**. It does not call `setPixelRGBW`, where the ordinary gamma 2.2 LUT lives. Ambient's sRGB-to-linear stage is its gamma conversion. Do not add that LUT a second time just because `gc` is true.

At the display boundary, linear output must stay linear in the shader. The existing browser atlas accepts Game banks with `upload(frame, true)` (signature `upload(frame, linear=false)`): it encodes the linear RGBW display mix for the atlas and the shader decodes it once. An equivalent float-linear texture path is also possible. That display encoding is separate from firmware gamma and does not justify decoding the keys twice.

## 4. Left/right correction: demo versus live

**Keep the extra horizontal flip limited to the delivered demo playback by default.** `LedGameMode.sample` calls `sampleGameBank(..., true)`; the optional transform reverses rows 0–4 and 7, and exchanges rows 5/6. It was applied at the bank-to-preview boundary to align the demo's screen image with the current visualizer. It changes neither stored bank bytes nor the renderer's physical strip map, and it is not an established universal repair to model geometry or physical wiring.

`build-game-demo.py` uses `ambient.load_geometry()`, which reads the local operator direction/location calibration. `ambient.py` can itself apply `mirror_x`, per-strip direction changes, side swaps, and location remapping. Therefore the generated banks can already contain calibration effects. The bank manifest records source hashes and an endpoint calibration description, not a complete reusable live calibration descriptor.

The live API's `sent_keys` represent keys sent to the board in physical strip/address order. Start with **no additional demo mirror** and map those addresses to the calibrated 3D strip paths exactly once. Preserve sacrificial address indices when masking visible LEDs. Use the desk's current layout/location descriptor if available; a fixture calibration should not override it.

Validate with an asymmetric picture and sequential address identification: red on picture-left, blue on picture-right, and a back-to-front ramp on the wings. Compare the real desk and model. If that proves the live path also needs a correction, place it in a documented calibrated adapter; do not infer it solely from the demo. Existing horizontal tests establish the code transform, not current physical desk correctness.

## 5. Black Birch assets and settings

The base image is **[bir.jpg at the browser-reference root](browser-reference/bir.jpg)**. There is no separate Black Birch image under `assets/wood`. [catalog.mjs](browser-reference/catalog.mjs) supplies the species settings:

| Setting | Value |
| --- | --- |
| Photo | `./bir.jpg` |
| Material tint | `#1b1b1b` |
| Grayscale | true |
| Contrast boost | 3.2 about the photograph's mean |
| Face bump scale | 0.06 at grain visibility 100% |
| Grain-driven roughness | enabled |
| Tile scale | one repeat per 32 authored inches |
| Face texture rotation | π/2 |

In [studio.js](browser-reference/studio.js), the chain is `loadSpeciesPhoto → woodTextureFor → processGrainPhoto → applyGrainScale → applySurfaceFinish`. It converts a copy of the photograph to luminance, boosts contrast, applies the black tint through `MeshPhysicalMaterial.color`, and derives bump/roughness maps. `applySurfaceFinish` assigns the maps and treatment; the generation happens in its helper functions.

Default presentation is **gloss**, grain enabled, visibility 100%, sheen 100%. Its wood treatment is roughness 0.20/clearcoat 0.65. Satin is 0.40/0.25; matte is 0.68/0.08. Wood metalness is 0, IOR 1.5, clearcoat roughness 0.35. Match the actual selected treatment; “Black Birch” does not force satin. The generated roughness image is a non-color data texture. The processed albedo is sRGB. Each material role needs its own repeat/rotation view.

Plywood edges remain procedurally generated 12-ply laminations with bump scale 0.0016; missing face photography falls back to generated grain. For Black Birch/Black, the frame uses its separate powder-coat treatment, not the wood map. Include the root `bir.jpg`, species table, processing helpers, and selected scene/renderer profile in the first material milestone.

## Delivery note

The refreshed ZIP includes this Q&A and firmware rendering-authority snapshots with hashes. The firmware headers are references, not a standalone firmware build. No JavaScript firmware port, live metrics adapter, or Flutter lighting implementation is claimed to be completed by this documentation update.
