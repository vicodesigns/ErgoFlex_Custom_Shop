# Render pacing and shadow budget (2026-10-14)

Editing the large rooms lagged. Profiling the Library "executive" layout found
the cost was drawing, not editing logic (moving an item ~0.1 ms, releasing it
~23 ms):

- ~1,470 draw calls and ~830k triangles per frame; the ErgoFlex desk alone is
  886 meshes (295 hardware plates and 127 screws, each its own material).
- ~1,400 visible shadow casters, re-rendered into the VSM shadow map every frame.
- The loop drew at the display's refresh rate (144 Hz on the studio monitor),
  even with nothing moving.

## What changed

`render-pacing.mjs`, wired into `animate()` in `studio.js`:

| State | Frame rate | Shadow map |
|---|---|---|
| Idle | 10 fps trickle (async loads still appear) | every 1 s fallback |
| Hover, wheel, orbit, camera tween/damping | ≤ 60 fps | unchanged (the key light's shadow camera is fitted to the room, not the view) |
| Click, key, slider, held drag that is not an orbit | ≤ 60 fps | for 300 ms after the event |
| Desk lift/tilt/yaw/glide, groove, scene-desk routines, item or gizmo drag | ≤ 60 fps | every frame |
| Wall/ceiling cutaway flips, room switch | — | that frame |

Desk motion is detected by change (lift, yaw, glide, tilt, touchscreen), so a
move started from voice or the API keeps full rate. The first frame after
idle uses a 1/60 s step so motion does not jump by the idle gap.

Only the loop's own render sets `renderer.shadowMap.autoUpdate` from the plan,
and restores it to `true` afterwards. Any other render (tests, captures, the
review tools) still redraws shadows exactly.

`pruneTinyCasters(scene)` runs once a second after a render and turns off
`castShadow` and `receiveShadow` on meshes under 50 mm in world size (each mesh
checked once, flag `userData.tinyShadowCaster`). Both flags matter: with VSM
shadows three.js also draws shadow *receivers* into the shadow map, so the first
version (cast only, 2026-10-14) left those parts in the shadow pass. In the Library "house" layout that is 639 meshes —
desk hardware plates, screws, bolt tops, LED strip segments, wheel sub-parts and
phone parts — about half of all casters. Their shadows are smaller than a
shadow-map texel; room renders are pixel-identical before and after.

AR and WebXR sessions are never paced.

Debug: `ErgoFlex.renderPacing` exposes the pacer; `renderPacing.invalidate()`
forces a full redraw including shadows.

## Not done yet

- Merging each desk's static hardware into a few meshes (cuts hundreds of
  draw calls; must keep setup-mode part selection working).
- Lower resolution while dragging or orbiting, restored when idle.
