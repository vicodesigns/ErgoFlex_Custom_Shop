# LED pixel renderer and mapping diagnostic

October 3, 2026. PC2 owns the browser implementation. Firmware reference comes
from [the leds handoff](LED_VIEWER_FIRMWARE_HANDOFF.md). The shared-file exchange
is working; direct thread messaging remains blocked by the app's writer lock.

## What is ready

- Eight logical strip rows and configurable RGBW address counts/masks.
- Desk 02's current 106 addressable clusters as the provisional initial profile.
- One preallocated texture atlas driving the existing emissive strip materials.
- A normalized path attribute on each existing strip mesh. No manual mesh
  subdivision or extra per-pixel mesh/light is needed.
- A three-sample local pixel neighborhood on each desk spill field, rather
  than a whole-desk average. Shelf fields can mix the two lower-facing emitters.
- Standard and wide desktop geometry use the same physical strip identity and
  material; their fore/aft geometry coordinates are normalized independently.
- An explicit strip/address diagnostic. Base color/effect edits survive the test,
  End test restores the current base effect, and master LED off stops all output.
- Diagnostic controls are available only with `ledDiagnostics=1`. They are
  transient, not saved in projects or shown in the normal customer interface.

## Open and check

Open the local `product-demo.html?ledDiagnostics=1`, turn **LEDs on**, and expand
**LED strip mapping**. Pick a strip; a blank address illuminates the entire strip.
Enter address 0 and use **Next address** to step through that strip. **End test**
or closing the mapping panel returns to the selected Solid/Breathe/Color cycle.
This diagnostic operates only on the virtual desk, not on physical hardware.

Please compare these proposed associations with a physical sequential test:

| Firmware ID | Name | Count, Desk 02 | GLB index, zero-based | Provisional coordinate direction |
| --- | --- | --- | --- | --- |
| 0 | Top Shelf Top | 14 | 40 | Z maximum → minimum |
| 1 | Top Shelf Bottom Back | 14 | 41 | Z maximum → minimum |
| 2 | Top Shelf Bottom Front | 15 | 42 | Z maximum → minimum |
| 3 | Second Shelf | 14 | 39 | Z maximum → minimum |
| 4 | Desk Top Center | 14 | 2 | Z minimum → maximum |
| 5 | Desktop Left | 11 | 1; wide side 1 | X minimum → maximum |
| 6 | Desktop Right | 11 | 0; wide side 0 | X minimum → maximum |
| 7 | Foot Rest | 13 | 38 | Z maximum → minimum |

Saved operator calibration from October 1 places address zero on user-right
for IDs 0/1/2/3/7, user-left for ID 4, and back for IDs 5/6. The table now uses
those recorded endpoints: current geometry's user-left is Z minimum, back is X
minimum. This is historical operator evidence, not a fresh physical verification.
All 106 addresses remain provisionally visible; sacrificial/dead indices have
not been silently removed. See [PC2's integration status](led-pc2-integration-status.md).

### Required answers

For each strip, provide:

1. Whether the diagnostic lights the correct physical section.
2. Where physical address 0 sits, as left/right when viewed from the user side,
   or front/back for the two desktop side strips. A labeled photo is helpful.
3. Which address indices are sacrificial, disconnected or outside the visible
   diffuser. `visibleAddresses` must retain physical address numbers/order while
   omitting those sections from the model path.
4. Actual counts for the 48-inch and 60-inch builds. Current counts describe
   Desk 02 only; the preview deliberately labels them as such.

`led-strip-map.mjs` has `count`, `reverse`, `visibleAddresses`, rig, mesh and
coordinate-axis fields. A null mask currently means every address is provisionally
visible, not that there are no sacrificial addresses. Diagnostic white is
RGB=(255,255,255), W=0. Raw RGBW input is retained independently from display RGB.

## Rendering scope and limits

The atlas adds W to R/G/B with saturation for display, then converts sRGB into
linear rendering space. This is a display approximation. It does not reproduce
the firmware's quantization, hue trim, gamma, transition or current-limiting stages,
and is not a statement about measured white-channel color temperature or power.

Spill samples pixels near each receiver's projected strip coordinate and adjacent
addresses. The existing distance/facing/compartment/occlusion falloff remains.
This yields a localized pool for the diagnostic; it is not ray-traced lighting.
Light does not automatically propagate onto arbitrary furniture.

Native GLB/USDZ exports do not serialize these shader hooks, texture sampling or
the browser effect clock. They continue to use ordinary material/base-color
lighting; a diagnostic is not a native AR animation. Live Android AR uses the
same renderer, but still needs a physical-device visual check.

## Movement and Game Mode integration

Lift, tilt and wheel samplers, actual-motion ownership, optional real movement
sounds and compiled Game Mode video/frame playback are now integrated. Read
[the current integration status](led-pc2-integration-status.md) for frame provenance,
preview timing differences, tests and outstanding physical mapping checks.
Game Mode accepts final raw-linear drive banks; the atlas converts that encoding
once before display. The original diagnostic and movement frame encoding remains
separate from that final ambient stage.

## Verification

`npm run test:led-pixels` exercises all 106 address indices, eight geometry
identities, localized spill bindings, texture reuse, custom counts/masks/reversal,
RGBW display mixing, Standard/Wide switching, invalid-address refusal, master off,
and base-effect restoration. It captures a screenshot and checks JavaScript,
shader/compiler and asset errors. `npm run test:led-effects` retains the existing
Solid/Breathe/Color cycle regression checks. `node tests/product-ar-test.cjs`
also passes configured GLB export/load, launch gesture handoff, reused AR controls
and repeated mock WebXR sessions. Its Slow-speed expectation was updated to the
already selected 0.306 setting; no movement speed was changed in this milestone.

Software tests do not confirm hardware pixel-zero endpoints or sacrificial masks.
No firmware, physical desk or website deployment was changed. The newer browser
playback milestone adds explicitly enabled virtual movement sounds.
