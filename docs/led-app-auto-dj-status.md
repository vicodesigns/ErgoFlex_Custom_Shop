# App UI and Auto DJ — 4 October 2026

The furnished Studio, AR upgrades and LED previews were snapshotted and pushed to `main` as `6836637` before this pass.

## App surface

The shared mock app now uses Height / Glide / Tilt cards, charcoal surfaces, ivory knobs, pill speeds, numbered swipe-to-reveal presets and posture cards. Existing saved forms, bounds, pointer projection, fixed floor Glide directions and rotation LED direction are retained. Tap the bulb to toggle LED power; hold for 550 ms to open the LED Command Center (Shift+Enter with keyboard). Product lighting is removed from the toolbar above the viewer.

The sheet contains only working preview controls:

- **Light:** curated solid moods, colour picker/palette, decorative effects and brightness.
- **Music / Live:** demo or private local song, all ten music previews, play/pause, sound opt-in, volume, sensitivity, seek and repeat.
- **Music / Auto DJ:** Chill, Party, Rave, My rotation; Off/Rare/Sometimes/Often/Favorite weights; Standard/Reduced/Minimal comfort; 4/8/16-bar custom cadence; explicit local save; start/pause/resume and hand-back to manual effect.
- **Game Mode:** four intensity presets, colours or colours + music, brightness ceiling, synchronized demo video and lighting, transport and sound opt-in.
- **Automate:** movement indicators and movement sound/volume. Diagnostics appear only with `ledDiagnostics=1`.

The sheet reuses the existing control handlers and renderer. Its wide layout covers the app controller footprint, with settings beside the light status, no dimming backdrop and no model obstruction. Compact panels scroll inside that footprint. In WebXR it is mounted inside the DOM overlay; exit closes/restores it. It is a nonmodal web region, separate from Apple's native Quick Look UI.

## Auto DJ reference and limits

`led-auto-dj.mjs` follows the API registry in `music_auto_dj.go`: Chill uses Wave/Fire/Comet/Bass Sky (16 bars, 45 s fallback); Party uses Spectrum/Tower/Ripple/Pulse/Bass Sky/Wave/Comet (8 bars, 30 s); Rave uses Tower/Ripple/Spectrum/Strobe/Fire/Pulse (4 bars, 20 s). Custom ratings use integer weights 0–4 and a shuffled weighted deck that avoids immediate repeats when possible.

Comfort follows `music_auto_dj_settings.go`: Reduced halves flash-heavy selection weights and accepts every second reactive drop; Minimal excludes Strobe/Drop and substitutes a smooth Bass Sky response. The browser also dims Reduced flash-heavy previews. Quiet passages settle to an allowed quiet effect. The conductor uses the song clock and detected bass beats; pause holds it and seek/repeat rebases cadence. A reactive energy-rise cue has a cooldown and restores the phrase pool after its hold.

This is a browser preview conductor, **not a byte-identical port of the complete firmware/API DJ**. The existing music samplers remain adaptations. IX variants, saved physical look composition, tempo-lock confidence, per-tier remix and hardware overlays are not exposed as working browser features. No physical endpoint is contacted. Songs remain local; no capture or upload occurs.

Movement/completion cues retain their existing priority over music and Game Mode. Decorative state is preserved when these modes stop. No autoplay audio is introduced.

## Validation

- Pure Auto DJ: weighted pools, all built-ins, comfort exclusions, no-beat fallback, pause/seek and stop.
- Music integration: actual silent audio analysis, all effects, local song cleanup, mutual exclusion with Game Mode, movement priority and reduced/background cleanup.
- Responsive layout: desktop, unfolded-width and narrow screen card containment and sheet bounds.
- WebXR mock: repeated sessions, real app reuse, lift/tilt/Glide/wheel spin, sheet inside overlay, exit cleanup.
- Game Mode: playback/seek/presets, motion priority, fixed Glide directions and frame brightness ceiling.

Use the product preview URL with `v=app-dj-20261004`. The upload builder includes both new modules and the app logo; publishing to the website remains a separate upload.
