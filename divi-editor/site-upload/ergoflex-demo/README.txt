ErgoFlex LA Tech Week 3D viewer

For the large-desktop-trim-fix ZIP: extract directly inside the existing
wp-content/uploads/2026/promo/ergoflex-demo folder and overwrite files.
product-demo.html must be directly in that folder, not in another nested ergoflex-demo.
For the tuned-leds-upload ZIP: extract inside promo; it creates ergoflex-demo.
Then check https://ergoflexdesk.com/wp-content/uploads/2026/promo/ergoflex-demo/product-demo.html
The LA Tech Week Divi button must use /wp-content/uploads/2026/promo/ergoflex-demo/product-demo.html
for its Hosted 3D viewer URL.

The base model is assets/model/desk-public.glb, with edited shelf plates replacing the original geometry.
The trim and Extended desktop GLBs are included in assets/trim.
The Extended desktop uses desktopLwTrimV2.glb in place of the old trim mesh.
The desktop surface is unchanged; the replacement trim shares its lift and tilt rig.
Both animated touchscreen sizes, the touchscreen image, and both desktop-size LED GLBs are included in assets/motion.
The player lets viewers switch between Standard 48-inch and Extended 60-inch
desktops; it opens with the Extended 60-inch size, red trim, and updated birch finish.
The LED toggle, quick color swatches, and custom picker control the panel illumination.
The LED studio backdrop dims ambient lighting to show the LEDs.
The desktop reflection follows the shelf LED strip and fans out softly toward the front.
Studio includes tuned desktop width, cone angle, edge fade, reach and sharpness, plus foot width and fade controls.
The preferred September 29 tuning is the shared default for the viewer and Studio.
The desktop crossbar and legs catch LED light; the cage receives weaker lower-edge bounce.
Shelf backs, inside side panels, and nearby column faces receive LED bounce.
Mesh-aligned panel reflections avoid the angle-dependent area-light seam.
Desktop power-module faces receive the same LED color and dimming as the desktop reflection.
LEDs load off. Switching them on starts at 75% of the new maximum.
The displayed 100% brightness is 85% of the former maximum light output.
Use product-demo.html?v=app-dj-20261005 as the Divi Hosted 3D viewer URL to bypass older browser copies.
The viewer HTML revalidates on future visits; versioned runtime assets may stay cached.
The hidden AR viewer loads eagerly even outside the mobile iframe viewport.
AR preparation errors show the actual loading failure, rather than a device warning.
Android WebXR uses the live desk and the original ErgoFlex app panel, including Glide, turning, height, tilt and LEDs inside AR.
On large screens the AR app starts smaller, with drag/resize handles, size buttons and Reset.
AR size is calibrated from the selected desktop width, including trim, rather than lift travel.
Desk size lets the user enter a measured width; calibration is remembered separately for each size.
This scale correction applies to Android WebXR and the iOS Quick Look export.
Its large-screen layout is remembered; the cover-screen app stays docked at the bottom.
This avoids exporting/reloading the desk, preserves LED reflections, and reduces AR render resolution.
iOS Quick Look offers a tap-controls PREVIEW generated from the configured desk.
Tap legs for Sitting/Standing; tap wings to cycle -5, 39 and 65 degrees.
The Apple preview raises the desk when a tilt needs more floor clearance.
Apple documents these behaviors in USDZ too; a proprietary .reality compiler is not needed.
The tap behavior engine is NOT verified on a physical iPhone yet.
The iPhone launch dialog also offers Open current pose only, using the original export.
Added desk accessories currently use that current-pose option.
Android AR and its existing controller are unchanged; they do not load the Apple exporter.
The first LED on/off cycle switches to LED studio then Slate; subsequent toggles preserve the backdrop.
The initial demo posture is Standing: 43.5 inches at -5 degrees.
AR requires a compatible device; WebXR requires HTTPS and iframe xr-spatial-tracking permission.
The Sitting preset now uses 28 inches at 0 degrees.
Glide Slow is 20% faster than the previous Slow; Crawl and Ninja are unchanged.
Height and tilt preset buttons show 1, 2, 3; swipe up to reveal their saved values.
The shared Studio code also includes live grain visibility and sheen controls.
This bundle includes the current Studio tilt group.
The app keeps its wide layout on mobile and fits the full panel to the screen.
The extended touchscreen follows the 60-inch desktop front and side edges.
Its open angle matches the Standard touchscreen.
The app controls meet the viewer directly, without the former wide-layout toolbar.
The app now uses Height / Glide / Tilt cards and ivory controls.
Tap the bulb to switch LED power; hold to open the LED Command Center: Light, Music, Auto DJ, Game Mode and movement cues.
The wide Command Center covers the app controller without dimming or blocking the desk viewer.
Auto DJ offers Chill, Party, Rave and a weighted custom rotation with Standard / Reduced / Minimal flash comfort.
DJ settings save on the device; music starts only on a user tap and is muted until Hear music is enabled.
LED animations and Auto DJ are browser previews, not byte-identical firmware output or physical desk control.
Lift and tilt default to Fast. The clearance envelope limits tilt at low heights.
If the Studio tilt rig changes again, rebuild this bundle and upload again.
