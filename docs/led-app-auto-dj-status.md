# App UI and Auto DJ — 4 October 2026

The furnished Studio, AR upgrades and LED previews were snapshotted and pushed to `main` as `6836637` before this pass.

## App surface

The shared mock app now uses Height / Glide / Tilt cards, charcoal surfaces, ivory knobs, pill speeds, numbered swipe-to-reveal presets and posture cards. Existing saved forms, bounds, pointer projection, fixed floor Glide directions and rotation LED direction are retained. Tap the bulb to toggle LED power; hold for 550 ms to open the LED Command Center (Shift+Enter with keyboard). Product lighting is removed from the toolbar above the viewer.

The sheet contains only working preview controls:

- **Light:** curated solid moods, colour picker/palette, decorative effects and brightness.
- **Music / Live:** demo or private local song, all ten music previews, play/pause, sound opt-in, volume, sensitivity, seek and repeat.
- **Music / Live / Use computer audio:** browser-approved tab or system audio drives the same analyser, music effects and Auto DJ. Pause lights holds the live conductor clock; Stop sharing releases every track. Source switching, browser revocation and page disposal also release capture. File-only seek/repeat/speaker controls are hidden during sharing to avoid a speaker feedback loop.
- **Music / Auto DJ:** Chill, Party, Rave, My rotation; Off/Rare/Sometimes/Often/Favorite weights; Standard/Reduced/Minimal comfort; Switch on the beat; temporary remix/colour extras; explicit local save; start/pause/resume and hand-back to manual effect.
- **Game Mode:** four intensity presets, colours or colours + music, brightness ceiling, synchronized demo video and lighting, transport and sound opt-in.
- **Automate:** movement indicators and movement sound/volume. Diagnostics appear only with `ledDiagnostics=1`.

The sheet reuses the existing control handlers and renderer. Its wide layout covers the app controller footprint, with settings beside the light status, no dimming backdrop and no model obstruction. Compact panels scroll inside that footprint. In WebXR it is mounted inside the DOM overlay; exit closes/restores it. It is a nonmodal web region, separate from Apple's native Quick Look UI.

## Auto DJ reference and limits

`led-auto-dj.mjs` follows the API registry in `music_auto_dj.go`: Chill uses Wave/Fire/Comet/Bass Sky (45 s); Party uses Spectrum/Tower/Ripple/Pulse/Bass Sky/Wave/Comet (30 s); Rave uses Tower/Ripple/Spectrum/Strobe/Fire/Pulse (20 s). Custom ratings use integer weights 0–4 and a shuffled weighted deck that avoids immediate repeats when possible.

Comfort follows `music_auto_dj_settings.go`: Reduced halves flash-heavy selection weights and accepts every second reactive drop; Minimal excludes Strobe/Drop and substitutes a smooth Bass Sky response. The browser also dims Reduced flash-heavy previews. Quiet passages settle to an allowed quiet effect. The conductor uses the song clock and detected bass beats; pause holds it and seek/repeat rebases cadence. A reactive energy-rise cue has a cooldown and restores the phrase pool after its hold.

This is a browser preview conductor, **not a byte-identical port of the complete firmware/API DJ**. The existing music samplers remain adaptations. Browser intensity variants, temporary tuning and tier remixes are approximations; hardware gamma, audio physics, native composition catalogs and full tempo confidence are not byte-identical. No physical endpoint is contacted. Songs remain local; no capture or upload occurs.

Movement/completion cues retain their existing priority over music and Game Mode. Decorative state is preserved when these modes stop. No autoplay audio is introduced.

## Computer audio support

The user clicks **Use computer audio**, selects a tab or screen in the native picker and enables **Share audio**. `getDisplayMedia` requests audio with `systemAudio: include` and keeps the original source's speaker output enabled. It must request video too; the application disables and never consumes the video track, creates an audio-only Web Audio source, and never records or transmits the stream. The analyser's destination gain is always zero for capture.

For the reported Ubuntu setup, the embedded browser's window picker explicitly offered no audio and the host app became unresponsive. Recognizable Electron/ChatGPT/Codex user agents now receive Chrome instructions without opening that picker. This guard does not diagnose or fix the host app itself, and customized user agents might not identify the embed. Use the viewer and Spotify web player in the same desktop Chrome browser; select Spotify's browser playback device, share the Spotify tab and enable Share tab audio. The in-app help now includes these steps and a Spotify web player link.

There is no unrestricted sound-card access in a website. Available audio sources depend on the desktop browser/OS; a browser tab is the fallback when whole-computer sharing is absent. HTTPS/localhost, a click gesture and fresh permission are required. Cross-origin embeds need `allow="display-capture"` and a compatible parent Permissions Policy. Missing audio tracks or permission denial produce actionable messages without interrupting a previously playing file. Mobile capture is not promised.

References: [MDN getDisplayMedia](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getDisplayMedia), [Chrome sharing controls](https://developer.chrome.com/docs/web-platform/screen-sharing-controls).

## Validation

- Pure Auto DJ: weighted pools, all built-ins, comfort exclusions, no-beat fallback, pause/seek and stop.
- Music integration: actual silent audio analysis, all effects, local song cleanup, mutual exclusion with Game Mode, movement priority and reduced/background cleanup.
- Responsive layout: desktop, unfolded-width and narrow screen card containment and sheet bounds.
- WebXR mock: repeated sessions, real app reuse, lift/tilt/Glide/wheel spin, sheet inside overlay, exit cleanup.
- Game Mode: playback/seek/presets, motion priority, fixed Glide directions and frame brightness ceiling.
- Computer audio: generated real MediaStream/FFT, no speaker replay, live DJ clock/pause, first permission denial, no-audio cleanup, stale grants after Stop, browser revocation, demo switching and disposal. Native permission UI and physical system loopback remain device tests.

Use the product preview URL with `v=desktop-bands-back-20261005`. The upload builder includes both new modules and the app logo; publishing to the website remains a separate upload.

## Viewer fullscreen

The product demo’s Full screen button requests native fullscreen for the existing viewer and controller. The toolbar and page note are hidden; Exit full screen returns to the page. Browsers or embeds that deny native fullscreen use a viewport-filling layout, with Escape as an additional exit. The original canvas, app state and audio stream remain mounted. The controller scales to fit up to 40% of the available height, leaving the rest for the desk. The LED Command Center stays inside the fullscreen element over the controller, and returns to its usual parent on exit. Cross-origin hosts must grant fullscreen permission for native fullscreen.

## Strip mixing and saved looks

Auto DJ defaults to mixing up to three permitted effects across all eight strips. Phrase assignments stay stable until a phrase change; quiet sections and drops coordinate. All strips share the same audio analyser and music clock. My rotation’s Off ratings apply to every strip, and Minimal excludes Strobe/Drop. During mixed phrases a flash-heavy leader is limited to one strip when a non-flashing companion is available. Reduced scales flash-heavy rows to 65%. Mix Across Shelves can be disabled for unison. The current per-strip assignments are shown below the DJ controls. This remains a browser adaptation, not the full firmware remix system.

Light → Moods → My looks includes 31 saved desk recipes, including Master REGGAE, Rojo, Mexican Power and both Reggae variants (the static variant is labelled Reggae (Static)). Light → Palettes includes all nine saved user palettes: Bliz, G B, G Red, Mexi, Mexi 2, Neon HEAT, Reggae, Rg and Rgb. These were read from the API's configured database through a read-only connection, selecting only the owner of the named Master REGGAE preset and that owner's LED library. The bundle contains only normalized names, colour sections, strip power/brightness/effect/speed/direction and music sensitivity; account IDs, palette UUIDs, descriptions and credentials are omitted. No physical desk commands were sent.

Music wrappers are resolved into eight-strip recipes using global defaults plus per-strip overrides. Palette references are inlined. Hard sections use the firmware's pixel-centre addressing and boundary rule; smooth sections use integer interpolation. Night City's Rainbow/Aurora palette tables come from the firmware. Local imports still work and override included looks by name; imported named palette references must include the palette definitions.

Auto DJ has independent Off/Rare/Sometimes/Often/Favorite ratings for saved looks and palettes. Only the 24 music-capable looks enter DJ selection (22 saved in Music Mode and two mixed music-effect recipes). Seven non-music looks, including Daytime and Evening, remain in Light / Moods and cannot enter DJ even with stale Favorite ratings. Eligible looks default to Sometimes; palette substitutions default to Off to preserve original colours. A look selection renders its full authored strip recipe. Choosing a palette changes colours without restarting the audio source. Rated palettes enter the phrase rotation alongside original colours. Minimal excludes entire saved looks with Strobe/Drop; Reduced lowers their selection frequency and dims flash-heavy strips. Settings persist on the visitor's device. Movement/completion retain priority, then the current music recipe resumes.

The music effect shapes remain browser adaptations. Imported RGBW colours, palette boundaries, per-strip assignments, speed, direction, mirror, power and brightness are preserved, but hardware tuning, gamma, transitions and every intensity variant are not byte-identical.

## Wing illumination correction

The previous shader used abs(normal.z), giving the inside and outside wing faces identical spill. Each wing now has two signed-face receivers. Outer faces keep the original light pool, strength and their own physical wing source (5 or 6). Inner faces use the centre underside desktop strip (4), with a bounce gain of 0.18. Centre-strip darkness removes that inner LED bounce even when the outer wing strip is bright. Both receivers follow the same existing lift/tilt geometry; the sign is determined from each panel's position relative to the desk centre.

## Preset changes during Music Mode

The included library has 22 recipes explicitly saved in Music Mode, two additional mixed recipes with music effects (Mexi/Mexic), and seven static/decorative looks. Music recipes are marked with ♫ in My looks; detection uses both saved music metadata and per-strip music effect IDs. Selecting one starts the existing song/demo only if Music Mode is inactive. Selecting any preset while Music Mode is active retains the source, sharing grant, analyser, song/capture clock and explicit pause state. Static looks and quick moods recolour the current music animation rather than stopping playback. Saved music looks use their authored per-strip animation recipes. Manual look selection still exits Auto DJ rotation so the selected look holds; this does not stop Music Mode. A new browser load still requires a new sharing grant if computer audio is used.

## Smart DJ extras and motion tuning — 5 October 2026

The bar selector is retired; its persisted setting is ignored. Each program decides when a new phrase look is due. Switch on the beat defaults on, estimates stability from the last five detected beat timestamps, and lands a due change on the next beat. Missing or unstable tempo switches immediately; lost tempo waits no more than 1.5 seconds. Drops and quiet passages bypass this wait. Pause holds the song clock; seeking clears the beat history.

The additional working browser controls are Remix My Presets, Remix Sliders, Remix Physics, Mix Across Shelves, Color Bursts, Beat Randomize, Remix Bursts, and Color Dynamics Off / Story / Wide. New remix options are opt-in to preserve existing authored looks; Mix Across Shelves retains its existing enabled default. Settings are saved locally with the current ratings. D Blue Red, Berry Sound, Reggae Sounds and BlueRed Sound are already in the bundled music library.

`led-dj-overlay.mjs` derives temporary strip configs and rendering metrics. Preset remix uses only effects permitted by the program's pool and comfort policy; colours, palette sections, power and brightness stay authored. Effect-specific speed/intensity ranges change temporary tail, reach, width, scale or decay. Physics varies attack, decay and beat punch without writing the analyser's canonical metrics or the sensitivity control. Beat Randomize temporarily changes direction and mirroring; it leaves saved values alone. Dynamics shifts rendered colour while retaining each pixel's peak RGB intensity and white channel. Burst overlays are localized and require Color Bursts explicitly enabled; Remix Bursts alone never enables them. Reduced/Minimal comfort suppress bursts and abrupt beat randomization; reduced motion suppresses animation overlays. Stopping DJ discards its temporary state and restores manual music controls. These are browser adaptations of the feature semantics, not the native firmware algorithms.

Tilt rates are Slow 1.75, Medium/Auto 3.5, Fast 7 degrees/second. Glide rates are Crawl .0085, Ninja .034, Slow .0765, Medium .153, Fast .306 metres/second. Rotation uses the same glide rate with the existing wheel geometry. New Fast anchors to the old Slow; this follows the owner's visual comparison and is not measured hardware calibration. Lift rates are unchanged. Music Comet travel is five times slower; saved speed still scales it.

Validation includes music-only library filtering despite stale ratings, beat landing/missing beat/seek, immutable preset and analyser inputs, allowed-effect remix, local burst output, comfort suppression, overlay restoration, Comet travel and motion rate tiers. The isolated browser fixture exercises new controls and persistence while retaining the same live audio grant, fullscreen and existing saved-look behavior.

## Silver tilt-actuator reflection

The ten Linear_Actuators cylinder/rod meshes now carry mesh-aligned reflected-light receivers sourced solely from centre desktop underside strip 4. Standard and Extended source meshes have separate receivers gated by source visibility, so exactly one size contributes. The source frame is recomputed during rendering to follow lift, desktop tilt, cylinder swing and rod extension. Polished silver base materials remain intact; additive reflected colour uses facing and distance falloff. The existing pixel sampler supplies local animated colours and brightness from the centre strip, and power off clears the reflection.

## Three desktop reflection bands

Both desktop sizes and their power-module faces now receive three overlapping depth bands: Second Shelf (strip 3) nearest the desktop back, Top Shelf Bottom Front (strip 2) in the middle, and Top Shelf Bottom Back (strip 1) farther forward. The complete field is shifted approximately five inches rearward, including the power-module field, so the rear band fades onto the desktop back edge. Band spacing, width and intensity are retained. The order, rounded pools and softer forward spread follow the owner's real-desk photo references. Each band independently samples its strip's RGBW pixel frame, including animation, direction, dark pixels and per-strip brightness/power. Adjacent pixel samples soften reflections along the width; depth weights blend between bands without a hard seam. The existing desktop strength, reach, width, cone, edge fade and sharpness controls still apply. Power modules share the same coordinate frame. The receiver uses the existing panel mesh and cutouts through lift and tilt, with one draw per surface. This is a photo-guided shader approximation, not a ray-traced mirror.

Validation: isolated browser framebuffer samples compare all-off, each individual source, and all three sources. Each source peaks in its own depth band; both band boundaries contain contributions from their two neighbours. Standard and Extended show the same three independent sources. All ten desktop/module receivers share the atlas and clear on master off; lift/tilt rendering produces no shader errors. Cyan/blue/pink and RGB screenshots were inspected against the photo references.
