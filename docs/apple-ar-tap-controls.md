# Apple AR tap controls — test preview

Android keeps the existing WebXR workspace and controller. The new module loads
only when preparing the Apple Quick Look asset.

Apple supports the built-in tap and transform behavior schemas in USDZ, in
addition to interactive `.reality` files. We generate USDZ directly from the
configured Three.js model, preserving its textures, trim, LED strips, pose and
calibrated physical width. A Mac/Reality Composer export is not required by this
route. The existing static GLB-to-USDZ route remains available in the launch
dialog as **Open current pose only**.

## Intended interactions

- Tap either wood leg profile or lift column: Sitting **28″ / 0°**, or Standing
  **43.5″ / −5°**. A launch height below 35″ switches to Standing; other heights
  switch to Sitting.
- Tap either wing or its trim: cycle **−5° → 39° → 65° → −5°**. A level launch
  pose advances to 39°. Keep the height unless the existing clearance envelope
  requires raising it (42.5″ for Extended, 40.5″ for Standard at 65°).
- Whole-desk placement gestures remain Quick Look's own gestures.
- These are predefined animations; there are no JavaScript callbacks or live
  controller inside Quick Look. Closing AR does not update the webpage's pose.
- Browser-only LED reflection shaders cannot be represented by USDZ. Actual
  textured surfaces and LED-strip materials are exported.
- Added desk accessories currently use the static fallback, because their
  attachment animations are not yet authored into the tap asset.

## Implementation and validation limits

Pose samples come from the existing lift, tilt and actuator rigs. Sampling is
synchronous, restores the original scene in `finally`, and does not write saved
poses or localStorage. Parts with equivalent sampled motion share animated
parents, rather than hundreds of separate transform actions.

State-specific copies of the actual tappable surfaces share geometry files.
Inactive copies have zero scale. Each active copy animates directly to the full
destination transform; the completed transition activates a destination copy
with that SAME full transform. Copies have stationary parents, separate from
the animated ordinary parts. No finishing step resets a wing to identity under
an animated parent. Apple tap triggers target the rendered mesh prims. Exclusive
behaviors and ignored duplicate invocations limit overlapping animations.

`node tests/apple-ar-test.cjs` exercises browser export, preserved configuration,
the finite pose graph and clearance rules, the fresh launch gesture and static
fallback. `tools/validate-apple-ar.py` uses OpenUSD to validate syntax, references,
ZIP alignment, behavior targets and endpoint transforms.
It also evaluates every leg/wing transition with local and world transform
interpretations, comparing all 806 surfaces immediately before and after the
copy handoff. This catches the snap-back observed in the first physical test.

The first physical iPhone test opened the asset and played the lift and tilt
animations, but the wings returned to their initial positions at the copy
handoff. The revised hierarchy fixes that handoff in offline validation.
**A physical iPhone must still verify this fix, repeated taps and animation
timing.** Linux/browser tests cannot prove those Apple runtime behaviors.
If the preview fails, use the static option and
record the iPhone model/iOS version and whether the asset opens, which taps work,
and whether the animation returns correctly after several cycles.

## Upload and test

Extract `divi-editor/site-upload/ergoflex-demo-iphone-taps-handoff-fix.zip` directly
inside the existing `wp-content/uploads/2026/promo/ergoflex-demo` folder, overwriting
files. Test the hosted `product-demo.html?v=apple-taps-handoff-fix-20260930` URL in Safari
on iPhone. Tap **AR/XR**, then **Try iPhone tap controls**.

Test both leg sides repeatedly, both wings for a full tilt cycle, and the 65°
clearance raise from Sitting. Then close AR and verify **Open current pose only**.
Recheck the Android controller after the upload.

## Sources

- [Apple: Actions and triggers](https://developer.apple.com/documentation/usd/actions-and-triggers)
- [Apple: Preliminary_Behavior](https://developer.apple.com/documentation/usd/preliminary-behavior)
- [Apple: TransformAction](https://developer.apple.com/documentation/usd/transformaction)
- [Apple: Creating USD files for Apple devices](https://developer.apple.com/documentation/usd/creating-usd-files-for-apple-devices)
