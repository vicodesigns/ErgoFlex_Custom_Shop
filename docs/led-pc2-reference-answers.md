# Answers to PC2's integration questions

2026-10-03. Replies to `ErgoFlex_Custom_Shop/docs/led-pc2-integration-status.md`
and `docs/led-pixel-mapping.md`. No physical desk was commanded or photographed.

## 1. Address-zero endpoints, viewed from the user side

**Update after tracing the existing Game Mode calibration:** the local saved
calibration DOES establish recorded endpoint directions. It was found at
`/home/ergo/.config/ergoflex/strip_directions.json`, with answers timestamped
`2026-10-01T22:51:29`. This is saved operator calibration, not a new physical
measurement by this thread. No labeled photos were found.

`tools/game_mode_proto/calibration_map.py:17` explains that the stored answer is
the comet's TRAVEL direction, not the address-zero endpoint. “Left” maps to p1
(the RIGHT endpoint); “Right” maps to p0 (LEFT). Side-strip “Down” means travel
toward the user/front and maps zero to p0 (BACK).

| ID | Saved led0_at | Saved travel answer | Recorded physical zero endpoint, user-facing |
| --- | --- | --- | --- |
| 0 | p1 | Left | Right |
| 1 | p1 | Left | Right |
| 2 | p1 | Left | Right, including sacrificial address 0 |
| 3 | p1 | Left | Right |
| 4 | p0 | Right | Left |
| 5 | p0 | Down | Back, including sacrificial address 0 |
| 6 | p0 | Down | Back, including sacrificial address 0 |
| 7 | p1 | Left | Right |

Use these saved Desk 02 directions as the versioned physical calibration input.
Still inspect which GLB min/max corresponds to user-left/right or back/front;
`p0/p1` are SCREEN-SAMPLING coordinates, not model X/Z bounds. PC2's geometry
associations remain provisional until the virtual sequential test matches them.

Existing `tools/game_mode_proto/geometry.json` is explicitly a FIRST draft whose
`led0_at` values are UNKNOWN pending a chase wizard. Its `p0` assignments must
not be promoted into a verified electrical map. The old front-grille left/right
description establishes orientation, not address-zero location.

Known relative facts: IDs 5/6 are left/right fore-aft strips; ID 4's wiring is
opposite the other lateral strips. IDs 1/2 correspond to 822c/822b, respectively,
not alphabetical wiring order (`Firmware/ergoled_firmware/src/EffectEngine.h:2182`).
Set `reverse` only after translating these physical endpoints into the actual
GLB local axes; do not simply copy a sampling-line reversal into model axes.

## 2. Visible and sacrificial indices

There is more documentation than the earlier handoff identified:
`docs/LED_ACCEPTANCE_TEST.md:110` documents Desktop Left's added pixel at the
**start** of the data run, like Desktop Right, and `:112` references Top Shelf
Bottom Front. `docs/game_mode/GAME_MODE_WIRE_SPEC.md:180` explicitly resolves
this to address **0** on IDs **2, 5, 6** and identifies Foot Rest's dead last
address. The prototype geometry uses `skip: [0]` for those three strips.

| ID | Address count, current Desk 02 | Documented exceptional addresses | Proposed visible mask ONLY if hidden/dead status is confirmed |
| --- | --- | --- | --- |
| 0 | 14 | None documented | 0–13 |
| 1 | 14 | None documented | 0–13 |
| 2 | 15 | Sacrificial address 0 | 1–14 |
| 3 | 14 | None documented | 0–13 |
| 4 | 14 | None documented | 0–13 |
| 5 | 11 | Sacrificial address 0, added October 1 | 1–10 |
| 6 | 11 | Sacrificial address 0 | 1–10 |
| 7 | 13 | Address 12 documented as not lighting | 0–11 |

**Sacrificial does not automatically mean invisible.** The wire spec explicitly
says human visibility is unknown. For IDs 2/5/6, the index is documented, but
excluding it from the visible diffuser still needs Vico's confirmation. ID 7's
dead endpoint is documented, but needs a current hardware check before asserting
it remains dead after repairs. Absence of a documented exception on another strip
does not prove every address is visible.

Preserve all 106 physical addresses in samplers/fixtures and use a separate
rendering mask. Do not renumber pixel 1 to physical address 0 after hiding a pad.
The proposed excluded set leaves 102 visible addresses; label that a proposed
mask, NOT a measured visible count. Record strip-map version, desk identity,
verification date, endpoint status and per-address visibility independently.

## 3. 48-inch versus 60-inch wiring/counts

**No verified separate electrical BOM/count profile was found.** The current
array in `Firmware/ergoled_firmware/src/config.h:35` is Desk 02's
`[14,14,15,14,14,11,11,13]`; it does not identify desktop width.
The October 1 GPIO/count repair is desk-specific, not a Standard/Wide variant.

PC2's reuse of IDs/materials across geometry variants is a valid preview
implementation, but the UI/profile must not imply that it establishes either
build's real wiring. Keep the Desk 02 profile separate from size selection and
allow a later size-specific verified map. Request measured counts and endpoint
checks on each physical build before shipping a claimed electrical counterpart.

## 4. Tilt actuator semantics — established

This is verified in executable conversion/dispatch code, not only LED comments:

- `ergoflex_api/utils/utils.go:254`: angle = 65 - pulses / pulsesPerDegree;
  zero pulses is 65°, increasing pulses lowers angle toward -5°.
- `ergoflex_api/routes/desk_relative.go:18`: tilt extend increases pulses and
  therefore **decreases physical/display angle**; retract decreases pulses and
  **increases physical/display angle**. `relativeDirection` implements this.
- LED payload `services/ergoled_native_anim.go:387`: extend → FX35 ix0,
  yellow `(255,255,0,0)`; retract → FX35 ix128, purple `(150,0,255,0)`.
- Sound map `services/audio_safety_indicator_service.go:48`: respectively
  `movement_tilt_extend.mp3` and `movement_tilt_retract.mp3`.
- Browser `ErgoFlex_Custom_Shop/motion-limits.mjs:12`:
  `rigDegreesForTilt(displayDegrees) = -5 - displayDegrees`.

Therefore, when observing **displayed physical tilt angle**:

| Actual angle delta | Actuator action | Meaning | FX35 ix | Color/sound |
| --- | --- | --- | --- | --- |
| Negative | extend | Toward horizontal / -5° minimum | 0 | Yellow / tilt_extend |
| Positive | retract | Toward vertical / 65° maximum | 128 | Purple / tilt_retract |
| Zero | no motion | Limit/held input must not produce a motion cue | — | No movement tone |

The browser rig's Euler delta has the opposite sign. Observe displayed angle or
invert the rig transform; do not bind actuator semantics to generic “up/down”
button names. This resolves the tilt-direction software integration gate; physical
endpoint verification is still a different gate.

## Deterministic RGBW sampler fixtures

Ready in the firmware-reference project:

- `tools/fixtures/led-movement-reference.mjs`: portable source-derived sampler.
- `tools/fixtures/led-movement-reference-v1.json`: 56 full frames covering lift
  up/down, tilt extend/retract and all ten wheel modes at 0, 250, 1000, 2000 ms.
- `tools/fixtures/led-movement-reference.test.mjs`: five passing tests for frame
  shape/range/determinism, lift direction/depth, ten wheel directions/caution,
  alternating pulse colors, and invalid inputs.

Each frame includes fx/ix/sx, RGBW color stops, elapsedMs, brightness and all
eight rows in physical address order. Top-level map ID is
`desk02-config-2026-10-01-address-space-v1`, with explicit counts and stage:
**post-channel-brightness, pre-gamma, pre-transition, pre-current-limit**.
No hidden-address mask is applied. All 106 addresses are represented.

Clock assumptions: fresh shared motion phase starts at zero; wall-clock warning
and linear-pulse uptime origin also zero. Real firmware retains motion phase
across activations and uses uptime for pulses, so recording a real desk requires
its phase/uptime origin as well as elapsed time.

These are **source-derived JS algorithm references**, NOT ESP32-captured output,
not independently compiled C++ golden frames, and not a claim of byte-identical
float32 math. Integer quantization is preserved, but JS float64 versus firmware
float32 can differ near a brightness/pixel boundary. Use a small numeric
tolerance only for documented arithmetic differences, while asserting exact
strip role/color/direction/mask behavior. Native hardware/compiled C++ output is
the next stronger validation gate.

Commands from the firmware-reference root:

```sh
node --test tools/fixtures/led-movement-reference.test.mjs
node tools/fixtures/led-movement-reference.mjs > tools/fixtures/led-movement-reference-v1.json
```

The sampler supports custom 1–16 counts per strip; do not use a Desk 02 golden
row length as a universal hardware length. Host-native sx is 160 for lift/tilt
and 180 for wheels, brightness 255. Movement references do not enable gamma;
music parity needs a separate reference for its gamma/normalization/state.

## Proceed without inventing missing hardware facts

PC2 can implement and test motion, restoration and real opt-in sounds against
the provisional address map now, with clear preview labeling. Lift/tilt direction
and wheel choreography are defined even though absolute geometry endpoints still
need confirmation. Do not claim verified physical mapping or silently change
reversal/masks based solely on prototype assumptions.

The remaining user check is a labeled sequential address test for each strip
to confirm the saved calibration against the current build and GLB axes,
visibility of pads 0 on IDs 2/5/6, current Foot Rest address 12 behavior, and
actual Standard/Wide hardware counts. No fabricated photos or endpoints are supplied.

## Priority correction discovered in current Game Mode code

The earlier firmware handoff considered only the base motion rank of 60 and
incorrectly suggested that motion over music was a demo-only behavior difference.
Current executable code elevates motion over BOTH music and Game Mode:
`services/led_status_indicator_service.go:2587` calls
`IsAmbientOwnerActiveForUser`, selecting `PriorityStatusOverride=114` in lift,
tilt and wheels entry paths. Ambient modes own rank 110. Safety/OTA remain above
114. Latest-started equal-rank motor ownership still applies.

PC2 should show movement over either ambient mode, then resume the CURRENT ambient
stream after owner-safe clearing. Do not stop/restart the source clip or restore
an obsolete frozen pixel frame. See `docs/led-game-mode-browser-handoff.md` for
the added Game Mode integration scope.
