# Playable cinematic intro

Implemented 26 October 2026. Open `/experience/` through the running web server,
not as a `file://` page. The root page introduces first-time visitors; existing
room/editing links continue to open their workspace. “Watch intro” replays it.

The main story has 85 seconds of animation, excluding environment loading.
`/experience/?cut=social` plays the 30-second cut from the same shot library.
The reel is a live presentation, not an exported video file.

Included: blue floor reveal and glide, sit-to-stand, drafting/easel tilt, Humboldt,
OCC and HBHS environments, wellness reminder with a copied breathing clip,
simulated proximity pylons/sweep/stop, music lighting, the reference app's curved
media display and bundled video, 65° storage and a cyan hero/CTA. Playback has
pause, chapter selection, replay, skip, sound, responsive framing and reduced
motion support. Hidden tabs pause playback and audio.

The scene iframe receives an in-memory snapshot of browser storage before Shop
imports run. Its writes cannot replace owner builds, artwork, layout edits or
per-size recipes. IndexedDB artwork writes are also disabled for this preview.
The intro completion flag is independent of Flutter onboarding.

## Copied app and integration boundary

`app-reference/` is a copy of the supplied `build/web_live`, with 4,892 source
file hashes recorded in `source-manifest.json`. The original project was read
only. Two copied files were patched: the HTML base/relay include and the viewer
iframe's message relay. `shop-mirror.js` is a new local integration file.

The CTA opens the actual compiled Flutter UI, including its existing demo entry
and onboarding. Its window can be expanded, compact or collapsed. In compact
mode, accepted virtual pose messages mirror height, tilt and floor pose into
the Shop hero preview. Messages require the expected window source and origin;
the pose sequence/session are checked. No hardware commands originate here.

The app retains its own mature viewer for its full media, AR, LED and coaching
features. A complete replacement of that renderer by the Shop's room renderer
is a further integration step; the pose mirror does not claim protocol parity
for every app feature. The intro itself uses the richer Shop scenes.

## Verification

- `node tests/cinematic-test.mjs`: both score durations, safe return paths and
  protection of the real saved-build store.
- `node tools/experience/verify-reference.mjs`: original source hashes and
  unchanged copied resources, excluding the two documented local patches.
- JavaScript syntax checks for the player, adapter and studio integration.
- Browser inspection of real room transitions, curved video playback, proximity
  staging and the copied Flutter demo/onboarding entry.

First playback may pause between chapters while GLB room resources load. Sound
starts through the explicit sound control to follow browser autoplay rules.

## Transition and motion refinement

Room changes now hold a bitmap of the outgoing 3D frame while the next room is
constructed, compiled and rendered. The prepared room dissolves in over 800 ms;
captions fade in separately. A loading label appears only for longer waits.
This uses one live renderer and one temporary canvas, with no second room
rendering behind the transition.

Camera and desk poses sample one absolute playback clock immediately before
each rendered frame. The preview's old 30 fps frame-skipping limit and competing
camera controller are disabled. Route waypoints are weighted by distance and
rotation, so unequal segments don't cause sudden speed changes. Full desktop
bounds are measured when a shot is prepared, and video-colour/UI sampling is
throttled independently of motion. Preview shadow maps are capped at 1024 and
redrawn only when geometry moves, at most 30 times per second.

`node tests/cinematic-timing-test.mjs` checks irregular frame intervals,
pause/resume and distance-weighted routes. Add `?stats=1` to the experience URL
for live frame-rate and frame-interval diagnostics; results depend on the device
and scene. The scene-loading time is still excluded from the story clock.
