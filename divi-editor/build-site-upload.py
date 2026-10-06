"""Build the small static 3D viewer bundle for the live LA Tech Week page."""

from pathlib import Path
import hashlib
import json
import re
import shutil
import zipfile


ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'divi-editor' / 'site-upload' / 'ergoflex-demo'
RELEASE = 'desktop-tilt-reach-20261006'
WEBSITE_ZIP = 'ergoflex-explore-3d-tilt-lighting-20261006.zip'
FILES = (
    'product-demo.html', 'product-demo.css', 'product-demo.js',
    'studio.js', 'studio.css', 'app-remote.css', 'ar-workspace.mjs', 'apple-ar-interactions.mjs', 'led-effects.mjs', 'led-strip-map.mjs', 'led-pixel-renderer.mjs',
    'led-movement.mjs', 'led-sounds.mjs', 'led-game-mode.mjs', 'led-game-frames.mjs',
    'led-music-mode.mjs', 'led-showcase-effects.mjs', 'led-auto-dj.mjs', 'led-dj-overlay.mjs', 'led-command-center.mjs', 'led-custom-presets.mjs', 'led-saved-library.mjs',
    'catalog.mjs', 'project-io.mjs', 'validation.mjs', 'motion-limits.mjs',
    'workspace-3d.mjs', 'room-refinement.mjs', 'room-life.mjs', 'room-groove.mjs', 'room-groove-runtime.mjs', 'room-collision.mjs', 'room-safety.mjs', 'touchscreen-display.mjs', 'room-interactions.mjs', 'room-led-spill.mjs', 'home-office.mjs', 'gaming-room.mjs', 'music-room.mjs', 'artist-room.mjs', 'study-room.mjs', 'office-room.mjs', 'gym-room.mjs', 'kitchen-room.mjs', 'lounge-room.mjs', 'workshop-room.mjs', 'bedroom-room.mjs', 'gallery-room.mjs', 'scifi-room.mjs', 'coworking-room.mjs', 'library-room.mjs', 'workspace-icons.mjs', 'bir.jpg',
)

OUT.mkdir(parents=True, exist_ok=True)
for name in FILES:
    shutil.copy2(ROOT / name, OUT / name)
    if Path(name).suffix in ('.html', '.js', '.mjs', '.css'):
        text = (OUT / name).read_text()
        # The uploaded release gets one cache key throughout the module graph,
        # including dependencies whose older URL had no version query at all.
        text = re.sub(r'\?v=[A-Za-z0-9_-]+', '?v=' + RELEASE, text)
        text = re.sub(
            r"((?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s*)['\"])(\./[^'\"]+\.m?js)(?:\?v=[^'\"]+)?(['\"])",
            lambda match: match[1] + match[2] + '?v=' + RELEASE + match[3],
            text,
        )
        (OUT / name).write_text(text)
for folder in ('assets/app-icons', 'assets/wood', 'assets/trim', 'assets/motion', 'assets/model', 'assets/led'):
    shutil.copytree(ROOT / folder, OUT / folder, dirs_exist_ok=True)

# Ship the edited public model with the viewer; room props are not bundled.
(OUT / '.htaccess').write_text(
    'AddType text/javascript .mjs\n'
    '<FilesMatch "\\.(html|js|mjs|css|json)$">\n'
    '  <IfModule mod_expires.c>\n'
    '    ExpiresActive Off\n'
    '  </IfModule>\n'
    '  <IfModule mod_headers.c>\n'
    '    Header set Cache-Control "no-cache, max-age=0, must-revalidate"\n'
    '  </IfModule>\n'
    '</FilesMatch>\n'
)
(OUT / 'README.txt').write_text(
    'Explore ErgoFlex in 3D — release ' + RELEASE + '\n\n'
    'UPLOAD THIS WEBSITE PACKAGE: ' + WEBSITE_ZIP + '\n'
    'Upload and extract directly inside the existing\n'
    'wp-content/uploads/2026/promo/ergoflex-demo folder. Allow overwriting files\n'
    'when uploading/extracting. Uploading the ZIP without extracting does not update the website.\n'
    'product-demo.html must be directly in that folder, not in another nested ergoflex-demo.\n'
    'Set the Divi Hosted 3D viewer URL (Explore ErgoFlex in 3D button) to:\n'
    '/wp-content/uploads/2026/promo/ergoflex-demo/product-demo.html?v=' + RELEASE + '\n'
    'Test the direct URL with the new version query, then test the Divi button.\n'
    'BUILD.json should show release ' + RELEASE + '. It also contains file hashes.\n'
    'physical-auto-dj-engineer-handoff.zip is documentation/reference material, not this website.\n\n'
    'The base model is assets/model/desk-public.glb, with edited shelf plates replacing the original geometry.\n'
    'The trim and Extended desktop GLBs are included in assets/trim.\n'
    'The Extended desktop uses desktopLwTrimV2.glb in place of the old trim mesh.\n'
    'The desktop surface is unchanged; the replacement trim shares its lift and tilt rig.\n'
    'Both animated touchscreen sizes, the touchscreen image, and both desktop-size LED GLBs are included in assets/motion.\n'
    'The player lets viewers switch between Standard 48-inch and Extended 60-inch\n'
    'desktops; it opens with the Extended 60-inch size, red trim, and updated birch finish.\n'
    'The LED toggle, quick color swatches, and custom picker control the panel illumination.\n'
    'The LED studio backdrop dims ambient lighting to show the LEDs.\n'
    'The desktop reflection has three blended depth bands driven independently by the lower shelf and upper underside front/back strips.\n'
    'All three desktop reflection bands are shifted approximately five inches toward the rear edge, including the power-module reflections.\n'
    'Desktop light reach follows physical tilt: the existing -5-degree look is preserved, level extends its depth by 25%, and positive tilt fills the front more.\n'
    'The smooth extension settles at +15 degrees; both desktop sizes and power modules share the same rear-anchored field.\n'
    'This curve is tuned from the owner\'s visual comparison, not a measured photometric simulation. Manual surface controls remain available.\n'
    'Studio includes tuned desktop width, cone angle, edge fade, reach and sharpness, plus foot width and fade controls.\n'
    'The preferred September 29 tuning is the shared default for the viewer and Studio.\n'
    'The desktop crossbar and legs catch LED light; the cage receives weaker lower-edge bounce.\n'
    'Shelf backs, inside side panels, and nearby column faces receive LED bounce.\n'
    'Mesh-aligned panel reflections avoid the angle-dependent area-light seam.\n'
    'Desktop power-module faces receive the same LED color and dimming as the desktop reflection.\n'
    'LEDs load off. Switching them on starts at 75% of the new maximum.\n'
    'The displayed 100% brightness is 85% of the former maximum light output.\n'
    'Runtime scripts, module imports, styles and previously versioned assets use the new release cache key.\n'
    'Full screen shows only the live desk and app controls, preserving music capture and the LED Command Center.\n'
    'Auto DJ: Mix Across Shelves toggles strip mixing; DJ extras default enabled with Wide Color Dynamics and 100% sensitivity.\n'
    'Light / Moods / My looks imports supported saved LED JSON presets on the visitor device.\n'
    'Auto DJ has separate look and palette frequency ratings; palette colours preserve hard edges.\n'
    'DJ uses only 24 music-capable looks; Daytime and other static looks stay in Light / Moods.\n'
    'Switch on the beat replaces the bar selector; remix, dynamics and opt-in localized burst controls are included.\n'
    'Music Comet travels five times slower. Motion rates follow owner feedback, not measured hardware calibration.\n'
    'Music looks are marked with a music note. Preset changes keep active music/sharing and pause position.\n'
    'Wing outer faces retain full reflection; inner faces receive weak centre-desktop-strip bounce.\n'
    'Silver tilt actuators reflect the centre desktop underside strip through lift, tilt and both desktop sizes.\n'
    'Includes 31 saved desk looks and 9 palettes, including Rojo, Master REGGAE and Mexican Power.\n'
    'Exit full screen returns to the page; embeds that deny native fullscreen fill the preview instead.\n'
    'The supplied Apache .htaccess revalidates HTML, scripts, styles and JSON on future visits.\n'
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
    'Tilt Slow/Medium/Fast: 1.75/3.5/7 deg/s. Glide Slow/Medium/Fast: .0765/.153/.306 m/s.\n'
    'Height and tilt preset buttons show 1, 2, 3; swipe up to reveal their saved values.\n'
    'The shared Studio code also includes live grain visibility and sheen controls.\n'
    'This bundle includes the current Studio tilt group.\n'
    'The app keeps its wide layout on mobile and fits the full panel to the screen.\n'
    'The extended touchscreen follows the 60-inch desktop front and side edges.\n'
    'Its open angle matches the Standard touchscreen.\n'
    'The app controls meet the viewer directly, without the former wide-layout toolbar.\n'
    'The app now uses Height / Glide / Tilt cards and ivory controls.\n'
    'Tap the bulb to switch LED power; hold to open the LED Command Center: Light, Music, Auto DJ, Game Mode and movement cues.\n'
    'The wide Command Center covers the app controller without dimming or blocking the desk viewer.\n'
    'Auto DJ offers Chill, Party, Rave and a weighted custom rotation with Standard / Reduced / Minimal flash comfort.\n'
    'Use computer audio prompts for tab or system audio sharing; system-wide support depends on browser and OS.\n'
    'Android Chrome, including Galaxy Fold, cannot share audio from another app. Unsupported sharing controls are hidden.\n'
    'Music / Live / Use microphone listens to music playing nearby after the visitor allows microphone access.\n'
    'Your song and Use demo soundtrack remain available; tap Start Music Mode after choosing either.\n'
    'Microphone analysis stays on the device, without recording, upload or speaker replay. Stop releases the microphone.\n'
    'Microphone access requires HTTPS (or localhost); if an embed blocks permission, open the viewer in its own tab.\n'
    'For cross-origin embeds, delegate microphone access with allow="microphone; fullscreen; xr-spatial-tracking".\n'
    'Compact LED Command Center pages share one touch scroller so every setting remains reachable on phones.\n'
    'Captured audio feeds the LED analyser locally, without replay, recording or upload; Stop sharing releases every track.\n'
    'DJ settings save on the device; music starts only on a user tap and is muted until Hear music is enabled.\n'
    'LED animations and Auto DJ are browser previews, not byte-identical firmware output or physical desk control.\n'
    'Lift and tilt default to Fast. The clearance envelope limits tilt at low heights.\n'
    'If the Studio tilt rig changes again, rebuild this bundle and upload again.\n'
)

# Give the installed website an independently readable release identity.
manifest = {
    'release': RELEASE,
    'entrypoint': 'product-demo.html?v=' + RELEASE,
    'files': {
        str(path.relative_to(OUT)): hashlib.sha256(path.read_bytes()).hexdigest()
        for path in sorted(OUT.rglob('*'))
        if path.is_file() and path.name != 'BUILD.json'
    },
}
(OUT / 'BUILD.json').write_text(json.dumps(manifest, indent=2) + '\n')

# The canonical update is flat: the owner is already in ergoflex-demo in cPanel.
website_update = OUT.parent / WEBSITE_ZIP
with zipfile.ZipFile(website_update, 'w', compression=zipfile.ZIP_DEFLATED) as z:
    for path in sorted(OUT.rglob('*')):
        if path.is_file():
            z.write(path, path.relative_to(OUT))
print(f'Built {website_update} ({website_update.stat().st_size:,} bytes)')

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
