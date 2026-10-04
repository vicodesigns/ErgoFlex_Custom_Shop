"""Build the small static 3D viewer bundle for the live LA Tech Week page."""

from pathlib import Path
import shutil
import zipfile


ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'divi-editor' / 'site-upload' / 'ergoflex-demo'
FILES = (
    'product-demo.html', 'product-demo.css', 'product-demo.js',
    'studio.js', 'studio.css', 'app-remote.css', 'ar-workspace.mjs', 'apple-ar-interactions.mjs', 'led-effects.mjs', 'led-strip-map.mjs', 'led-pixel-renderer.mjs',
    'led-movement.mjs', 'led-sounds.mjs', 'led-game-mode.mjs', 'led-game-frames.mjs',
    'led-music-mode.mjs', 'led-showcase-effects.mjs',
    'catalog.mjs', 'project-io.mjs', 'validation.mjs', 'motion-limits.mjs',
    'workspace-3d.mjs', 'room-refinement.mjs', 'room-life.mjs', 'room-groove.mjs', 'room-groove-runtime.mjs', 'home-office.mjs', 'gaming-room.mjs', 'music-room.mjs', 'artist-room.mjs', 'study-room.mjs', 'office-room.mjs', 'gym-room.mjs', 'kitchen-room.mjs', 'lounge-room.mjs', 'workshop-room.mjs', 'bedroom-room.mjs', 'gallery-room.mjs', 'scifi-room.mjs', 'coworking-room.mjs', 'library-room.mjs', 'workspace-icons.mjs', 'bir.jpg',
)

OUT.mkdir(parents=True, exist_ok=True)
for name in FILES:
    shutil.copy2(ROOT / name, OUT / name)
for folder in ('assets/app-icons', 'assets/wood', 'assets/trim', 'assets/motion', 'assets/model', 'assets/led'):
    shutil.copytree(ROOT / folder, OUT / folder, dirs_exist_ok=True)

# Ship the edited public model with the viewer; room props are not bundled.
(OUT / '.htaccess').write_text(
    'AddType text/javascript .mjs\n'
    '<Files "product-demo.html">\n'
    '  <IfModule mod_expires.c>\n'
    '    ExpiresActive Off\n'
    '  </IfModule>\n'
    '  <IfModule mod_headers.c>\n'
    '    Header set Cache-Control "no-cache, max-age=0, must-revalidate"\n'
    '  </IfModule>\n'
    '</Files>\n'
)
(OUT / 'README.txt').write_text(
    'ErgoFlex LA Tech Week 3D viewer\n\n'
    'For the large-desktop-trim-fix ZIP: extract directly inside the existing\n'
    'wp-content/uploads/2026/promo/ergoflex-demo folder and overwrite files.\n'
    'product-demo.html must be directly in that folder, not in another nested ergoflex-demo.\n'
    'For the tuned-leds-upload ZIP: extract inside promo; it creates ergoflex-demo.\n'
    'Then check https://ergoflexdesk.com/wp-content/uploads/2026/promo/ergoflex-demo/product-demo.html\n'
    'The LA Tech Week Divi button must use /wp-content/uploads/2026/promo/ergoflex-demo/product-demo.html\n'
    'for its Hosted 3D viewer URL.\n\n'
    'The base model is assets/model/desk-public.glb, with edited shelf plates replacing the original geometry.\n'
    'The trim and Extended desktop GLBs are included in assets/trim.\n'
    'The Extended desktop uses desktopLwTrimV2.glb in place of the old trim mesh.\n'
    'The desktop surface is unchanged; the replacement trim shares its lift and tilt rig.\n'
    'Both animated touchscreen sizes, the touchscreen image, and both desktop-size LED GLBs are included in assets/motion.\n'
    'The player lets viewers switch between Standard 48-inch and Extended 60-inch\n'
    'desktops; it opens with the Extended 60-inch size, red trim, and updated birch finish.\n'
    'The LED toggle, quick color swatches, and custom picker control the panel illumination.\n'
    'The LED studio backdrop dims ambient lighting to show the LEDs.\n'
    'The desktop reflection follows the shelf LED strip and fans out softly toward the front.\n'
    'Studio includes tuned desktop width, cone angle, edge fade, reach and sharpness, plus foot width and fade controls.\n'
    'The preferred September 29 tuning is the shared default for the viewer and Studio.\n'
    'The desktop crossbar and legs catch LED light; the cage receives weaker lower-edge bounce.\n'
    'Shelf backs, inside side panels, and nearby column faces receive LED bounce.\n'
    'Mesh-aligned panel reflections avoid the angle-dependent area-light seam.\n'
    'Desktop power-module faces receive the same LED color and dimming as the desktop reflection.\n'
    'LEDs load off. Switching them on starts at 75% of the new maximum.\n'
    'The displayed 100% brightness is 85% of the former maximum light output.\n'
    'Use product-demo.html?v=large-desktop-trim-fix-20261001 as the Divi Hosted 3D viewer URL to bypass older browser copies.\n'
    'The viewer HTML revalidates on future visits; versioned runtime assets may stay cached.\n'
    'The hidden AR viewer loads eagerly even outside the mobile iframe viewport.\n'
    'AR preparation errors show the actual loading failure, rather than a device warning.\n'
    'Android WebXR uses the live desk and the original ErgoFlex app panel, including Glide, turning, height, tilt and LEDs inside AR.\n'
    'On large screens the AR app starts smaller, with drag/resize handles, size buttons and Reset.\n'
    'AR size is calibrated from the selected desktop width, including trim, rather than lift travel.\n'
    'Desk size lets the user enter a measured width; calibration is remembered separately for each size.\n'
    'This scale correction applies to Android WebXR and the iOS Quick Look export.\n'
    'Its large-screen layout is remembered; the cover-screen app stays docked at the bottom.\n'
    'This avoids exporting/reloading the desk, preserves LED reflections, and reduces AR render resolution.\n'
    'iOS Quick Look offers a tap-controls PREVIEW generated from the configured desk.\n'
    'Tap legs for Sitting/Standing; tap wings to cycle -5, 39 and 65 degrees.\n'
    'The Apple preview raises the desk when a tilt needs more floor clearance.\n'
    'Apple documents these behaviors in USDZ too; a proprietary .reality compiler is not needed.\n'
    'The tap behavior engine is NOT verified on a physical iPhone yet.\n'
    'The iPhone launch dialog also offers Open current pose only, using the original export.\n'
    'Added desk accessories currently use that current-pose option.\n'
    'Android AR and its existing controller are unchanged; they do not load the Apple exporter.\n'
    'The first LED on/off cycle switches to LED studio then Slate; subsequent toggles preserve the backdrop.\n'
    'The initial demo posture is Standing: 43.5 inches at -5 degrees.\n'
    'AR requires a compatible device; WebXR requires HTTPS and iframe xr-spatial-tracking permission.\n'
    'The Sitting preset now uses 28 inches at 0 degrees.\n'
    'Glide Slow is 20% faster than the previous Slow; Crawl and Ninja are unchanged.\n'
    'Height and tilt preset buttons show 1, 2, 3; swipe up to reveal their saved values.\n'
    'The shared Studio code also includes live grain visibility and sheen controls.\n'
    'This bundle includes the current Studio tilt group.\n'
    'The app keeps its wide layout on mobile and fits the full panel to the screen.\n'
    'The extended touchscreen follows the 60-inch desktop front and side edges.\n'
    'Its open angle matches the Standard touchscreen.\n'
    'The app controls meet the viewer directly, without the former wide-layout toolbar.\n'
    'Lift and tilt default to Fast. The clearance envelope limits tilt at low heights.\n'
    'If the Studio tilt rig changes again, rebuild this bundle and upload again.\n'
)

archive = OUT.parent / 'ergoflex-demo-tuned-leds-upload.zip'
with zipfile.ZipFile(archive, 'w', compression=zipfile.ZIP_DEFLATED) as z:
    for path in OUT.rglob('*'):
        if path.is_file():
            z.write(path, path.relative_to(OUT.parent))
print(f'Built {archive} ({archive.stat().st_size:,} bytes)')

# For an existing installation, extract this archive *inside* ergoflex-demo.
# Include every changed runtime file and trim asset: a three-file layout-only
# update would leave the size toggle without its matching geometry.
flat_update = OUT.parent / 'ergoflex-demo-large-desktop-trim-fix.zip'
with zipfile.ZipFile(flat_update, 'w', compression=zipfile.ZIP_DEFLATED) as z:
    for path in OUT.rglob('*'):
        if path.is_file():
            z.write(path, path.relative_to(OUT))
print(f'Built {flat_update} ({flat_update.stat().st_size:,} bytes)')
